import {ec} from 'elliptic';
import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import * as _ from 'lodash';
import {getPublicKey, getTransactionId, signTxIn, Transaction, TxIn, TxOut, UnspentTxOut} from './transaction';


const EC = new ec('secp256k1');
const privateKeyLocation = process.env.PRIVATE_KEY || 'node/wallet/private_key';

const getPrivateFromWallet = (): string => {
    const buffer = readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};

const getPublicFromWallet = (): string => {
    const privateKey = getPrivateFromWallet();
    const key = EC.keyFromPrivate(privateKey, 'hex');
    return key.getPublic().encode('hex');
};

const generatePrivateKey = (): string => {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};

const initWallet = () => {
    // let's not override existing private keys
    if (existsSync(privateKeyLocation)) {
        return;
    }
    const newPrivateKey = generatePrivateKey();

    writeFileSync(privateKeyLocation, newPrivateKey);
    console.log('new wallet with private key created to : %s', privateKeyLocation);
};

const deleteWallet = () => {
    if (existsSync(privateKeyLocation)) {
        unlinkSync(privateKeyLocation);
    }
};

const getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
    return _(findUnspentTxOuts(address, unspentTxOuts))
        .map((uTxO: UnspentTxOut) => uTxO.amount)
        .sum();
};

const findUnspentTxOuts = (ownerAddress: string, unspentTxOuts: UnspentTxOut[]) => {
    return _.filter(unspentTxOuts, (uTxO: UnspentTxOut) => uTxO.address === ownerAddress);
};

const filterTxPoolTxs = (unspentTxOuts: UnspentTxOut[], transactionPool: Transaction[]): UnspentTxOut[] => {
    const txIns: TxIn[] = _(transactionPool)
        .map((tx: Transaction) => tx.txIns)
        .flatten()
        .value();
    const removable: UnspentTxOut[] = [];
    for (const unspentTxOut of unspentTxOuts) {
        const txIn = _.find(txIns, (aTxIn: TxIn) => {
            return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId;
        });

        if (txIn === undefined) {

        } else {
            removable.push(unspentTxOut);
        }
    }

    return _.without(unspentTxOuts, ...removable);
};

const createTransaction = (receiverAddress: string, amount: number, privateKey: string,
                           unspentTxOuts: UnspentTxOut[], txPool: Transaction[]): Transaction => {

    console.log('txPool: %s', JSON.stringify(txPool));
    const address = getPublicKey(privateKey); // Get the public key by private key
    const myUnspentTxOutsA = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === address);
    const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);
    const includedUnspentTxOuts = [];
    let leftTxOut = null;
    let currentAmount = 0;
    let leftOverAmount = 0;

    // Check if no UTxO in pool
    if (myUnspentTxOuts.length === 0) {
        const g = 'Cannot create transaction because the transaction require: ' + amount;
        throw Error(g + ' No transaction make');
    }
    // If UTxO in pool, calculate amount
    for (let i = 0; i < myUnspentTxOuts.length; i++) {
        includedUnspentTxOuts.push(myUnspentTxOuts[i]);
        currentAmount += myUnspentTxOuts[i].amount;
        console.log('currentAmount: ' + currentAmount);
        console.log('amount: ' + amount);
        if (currentAmount >= amount) {     // Transaction successful
            leftOverAmount = currentAmount - amount;
            i = myUnspentTxOuts.length;
        }
        if (currentAmount < amount  && i === myUnspentTxOuts.length - 1) {
            const msg = 'Cannot create transaction because the transaction require: ' + amount + ' Only have: ' + currentAmount;
            throw Error (msg);
        }
    }

    if (leftOverAmount > 0) {
        leftTxOut = new TxOut(address, leftOverAmount);
    }

    const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
        const txIn = new TxIn();
        txIn.txOutId = unspentTxOut.txOutId;
        txIn.txOutIndex = unspentTxOut.txOutIndex;
        return txIn;
    };

    const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);

    console.log('TXIN ID' + toUnsignedTxIn);

    const tx: Transaction = new Transaction();
    const txOut = new TxOut (receiverAddress, amount);
    tx.txIns = unsignedTxIns;
    if (leftTxOut != null) {
        tx.txOuts = [txOut, leftTxOut];     // If leftTxOut exist, add it into transaction
    } else {
        tx.txOuts = [txOut];
    }
    //   tx.txOuts = createTxOuts(receiverAddress, address, amount, leftOverAmount);
    tx.id = getTransactionId(tx);
    tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
        txIn.signature = signTxIn(tx, index, privateKey);
        return txIn;
    });

    return tx;
};

export {createTransaction, getPublicFromWallet,
    getPrivateFromWallet, getBalance, generatePrivateKey, initWallet, deleteWallet, findUnspentTxOuts};
