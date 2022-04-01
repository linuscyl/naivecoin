import * as  bodyParser from 'body-parser';
import * as express from 'express';
import * as mongoose from 'mongoose';
import * as redis from 'redis';
import * as _ from 'lodash';
import {
    Block, generateNextBlock, generatenextBlockWithTransaction, generateRawNextBlock, getAccountBalance,
    getBlockchain, getMyUnspentTransactionOutputs, getUnspentTxOuts, sendTransaction
} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet} from './wallet';

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;



const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(bodyParser.json());
    var redisResult;
    var dbResult;
    var max_index=-1;
    const redisUrl = 'redis://localhost:6379';
    const redisClient = redis.createClient();
    redisClient.on("error", function(error) {
        console.error(error);
    });
    
    
    app.post('/redis', (req, res) => {

        var call = redisClient.get(req.body.input,function (error, value) { redisResult=value;console.log(redisResult);res.send(redisResult);})
 
        
    });

    interface Blocks extends mongoose.Document{
        index: number;
        previousHash: string;
        timestamp: string;
        data:  JSON;
        hash:string;
        difficulty: number;
        nonce: number;
    };
    
    const schema = new mongoose.Schema({
        index: { type: String, required: true },
        previousHash: { type: String, required: false },
        timestamp: { type: String, required: true },
        data: { type: JSON, required: true },
        hash: { type: String, required: true },
        difficulty: { type: String, required: true },
        nonce: { type: String, required: true },
    },{ versionKey: false });
    
    const BlocksModel = mongoose.model<Blocks>('Blocks', schema);
    const mongodbUrl = 'mongodb://localhost:27017/test';
    mongoose.connect(mongodbUrl).catch(err => console.log(err));
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'MongoDB connection error:'));

    app.get('/dbw', (req, res) => {
    
        var list = [];
        for (let index=max_index+1;;index++,max_index++ )
        {
            if(getBlockchain()[index]==undefined){break;}
            var data:Block = getBlockchain()[index];
            var doc = new BlocksModel(data);
            doc.save().catch(err => console.log(err));
            list.push(doc);
        }
        res.send(list);

    });
    app.get('/dbr', (req, res) => {
        var indexCounter;
        var data = BlocksModel.find({}, { _id: 0 }).exec(function (error, value) { dbResult=value});
        dbResult.forEach(element => {
            const Objects:Block = element;
            redisClient.set(String(Objects.index)+":index",String(Objects.index));
            redisClient.set(String(Objects.index)+":previousHash",Objects.previousHash);
            redisClient.set(String(Objects.index)+":timestamp",String(Objects.timestamp));
            redisClient.set(String(Objects.index)+":data",JSON.stringify(Objects.data));
            redisClient.set(String(Objects.index)+":hash",Objects.hash);
            redisClient.set(String(Objects.index)+":difficulty",String(Objects.difficulty));
            redisClient.set(String(Objects.index)+":nonce",String(Objects.nonce));
            indexCounter+=1;
        });
        max_index = indexCounter;
        res.send(dbResult);
    });
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = _.find(getBlockchain(), {'hash' : req.params.hash});
        res.send(block);
    });

    app.get('/transaction/:id', (req, res) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.send(tx);
    });

    app.get('/address/:address', (req, res) => {
        const unspentTxOuts: UnspentTxOut[] =
            _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
        res.send({'unspentTxOuts': unspentTxOuts});
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTxOuts());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block = generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mineBlock', (req, res) => {
        const newBlock: Block = generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance();
        res.send({'balance': balance});
    });

    app.get('/address', (req, res) => {
        const address: string = getPublicFromWallet();
        res.send({'address': address});
    });

    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.post('/sendTransaction', (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;

            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = sendTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initWallet();
