import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash';
import {at} from "lodash";

const ec = new ecdsa.ec('secp256k1');

const COINBASE_AMOUNT: number = 50;

class Transaction {
    public id: string;
    public txIns: TxIn[];
    public txOuts: TxOut[];
}

// Get transaction ID
const getTransactionId = (transaction) => {
    const txInContent = (transaction.txIns[0].txOutId + transaction.txIns[0].txOutIndex).toString();
    const txOutContent: string = (transaction.txOuts[0].address + transaction.txOuts[0].amount).toString();
    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

class UnspentTxOut {
    public txOutId: string;
    public txOutIndex: number;
    public address: string;
    public amount: number;
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
    public txOutId: string;
    public txOutIndex: number;
    public signature: string;
}

class TxOut {
    public address: string;  // Public key of the receiver
    public amount: number;
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}

// Verify transation (b) part second requirement
// sendTransaction test.
const validateTransaction = (transaction, unspentTxOuts) => {
    let totalTxInValues = null;
    let totalTxOutValues = 0;
    let signUTxOut = null;
    const txIns = transaction.txIns[0];
    // transaction ID check
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid tx id: ' + transaction.id);
        return false;
    }
    // Check txIn array and signature
    if (transaction.txIns === null) {
        console.log('Invaild! TxIN is empty!');
        return false;
    }
    for (let i = 0; i  < transaction.txIns.length; i++) {
        // Check signature in str
        if (transaction.txIns[i] !== null) {
            console.log('Signature: ' + transaction.txIns[i].signature);
            if (typeof transaction.txIns[i].signature !== 'string') {
                console.log('The data type of signature is invaild!');
                return false;
            } else {
                console.log('data type valid');
            }
            // Check signature in hex
            if (transaction.txIns[i].signature.match('^[a-fA-F0-9 ]+$') === null) {
                console.log('The format of signature is not in hex');
                return false;
            } else {
                console.log('Signature structure vaild');
            }
        }
    }
    // P2PKH part check signature
    // Verify transactions with signature
    if (unspentTxOuts.length === 0) {
        console.log('no unspentTxOut');
    } else {
        for (let i = 0; i < unspentTxOuts.length; i++ ) {
            if (unspentTxOuts[i].txOutId === transaction.txIns[0].txOutId && unspentTxOuts[i].txOutIndex === transaction.txIns[0].txOutIndex) {
                signUTxOut = unspentTxOuts[i];
            }
        }
    }
    console.log('signUTxOut = ' + signUTxOut.txOutId + ' , ' + signUTxOut.txOutIndex);
    const address = signUTxOut.address;
    const key = ec.keyFromPublic(address, 'hex');
    const verifySignature: boolean = key.verify(transaction.id, transaction.txIns[0].signature);
    // Temp for testing
    if (verifySignature !== true) {
        console.log('Signature not verify!');
        return false;
    }
    // Check txOuts structure
    if (transaction.txOuts === null) {
        console.log('Invaild! TxOut is empty!');
        return false;
    }
    for (let i = 0; i < transaction.txOuts.length; i++) {
        if (typeof transaction.txOuts[i].address !== 'string') {
            console.log('The data type of address is invalid!');
            return false;
        } else {
            console.log('address vaild');
        }
        if (transaction.txOuts[i].address.match('^[a-fA-F0-9]+$') === null) {
            console.log('The format of address is not in hex');
            return false;
        } else {
            console.log('signature vaild');
        }
    }

    // Calculate total TxIn
    for (let j = 0; j < transaction.txIns.length; j++) {
        for (let i = 0; i < unspentTxOuts.length; i++) {
            if (unspentTxOuts[i].txOutIndex === transaction.txIns[j].txOutIndex && unspentTxOuts[i].txOutId === transaction.txIns[j].txOutId) {
                totalTxInValues += unspentTxOuts[i].amount;
                console.log('tx1: = ' + txIns);
            }
        }
    }
    console.log('Transfer TxIn: ' + totalTxInValues);

    // Calculate total txOut
    for (let i = 0; i < transaction.txOuts.length; i++) {
        totalTxOutValues += transaction.txOuts[i].amount;
    }
    console.log('Transfer TxOut = ' + totalTxOutValues);
    if (totalTxOutValues === totalTxInValues) {
        console.log('TxIn amount = TxOut amount');
    } else {
        console.log('TxIn amount not equal to TxOut amount');
        return false;
    }
    return true;
};
///////////////////////////////////////
// Block's transaction
// (c)
// modified
const validateBlockTransactions = (transaction, unspentTxOuts, blockIndex) => {
    // Check validation of coinbase block's transaction
    // Check the height of block is equal to txOutIndex
    if (transaction[0].txIns[0].txOutIndex !== blockIndex) {  // Refer to tutorial's code
        console.log('The txIn signature must equal to block height');
        return false;
    }
    // Check whether the amount is correct
    if (transaction[0].txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log('The coinbase amount is not correct! The value is: ' + transaction[0].txOuts[0].amount + ' The value should be ' + COINBASE_AMOUNT);
        return false;
    }
    // if vaild:
    return transaction.slice(1).map((transact) => validateTransaction(transact, unspentTxOuts)) // Use tutorial code
        .reduce((a, b) => (a && b), true);
};
///?????
const hasDuplicates = (txIns: TxIn[]): boolean => {
    const groups = _.countBy(txIns, (txIn: TxIn) => txIn.txOutId + txIn.txOutIndex);
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log('duplicate txIn: ' + key);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

const findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};

// Part (c)
// Coinbase transaction
// Initial coins come in to the blocktrains
const getCoinbaseTransaction = (address, index): Transaction => {
    const transaction = new Transaction();  // initial new coinbase transaction
    const txIn = new TxIn();
    const txOut = new TxOut(address, COINBASE_AMOUNT);
    let id = '';
    transaction.txIns = [];
    transaction.txOuts = [];
    txIn.signature = '';
    txIn.txOutId = '';
    txIn.txOutIndex = index;
    transaction.txIns.push(txIn);
    transaction.txOuts.push(txOut);
    // Create transaction ID.
    const txInContent = (transaction.txIns[0].txOutId + transaction.txIns[0].txOutIndex).toString();
    const txOutContent: string = (transaction.txOuts[0].address + transaction.txOuts[0].amount).toString();
    id = CryptoJS.SHA256(txInContent + txOutContent).toString();
    transaction.id = id;
    return transaction;
};

// Digital Signature: mineTransaction
// Sign the txIn file
// (b) first part
const signTxIn = (transaction, txInIndex, privateKey) => {
    const key = ec.keyFromPrivate(privateKey, 'hex');
    const signature: string = toHexString(key.sign(transaction.id).toDER());
    console.log('key = ' + key);
    console.log('signature = ' + signature);
    return signature;
};

// Tutorial given code
const updateUnspentTxOuts = (newTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
    const newUnspentTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => {
            return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
        })
        .reduce((a, b) => a.concat(b), []);
    const consumedTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter(((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
        .concat(newUnspentTxOuts);

    return resultingUnspentTxOuts;
};

// Tutorial code:
const processTransactions = (transactions, aUnspentTxOuts, blockIndex) => {
    if (validateBlockTransactions(transactions, aUnspentTxOuts, blockIndex) === false) {
        console.log('The block transaction is invalid');
        return null;
    } else {
        return updateUnspentTxOuts(transactions, aUnspentTxOuts);
    }
};

// Tutorial code:
const toHexString = (byteArray) => {
    return Array.from(byteArray, (byte: any) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};

// Tutorial code:
const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex');
};

// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
// Tutorial code:
const isValidAddress = (address: string): boolean => {
    if (address.length !== 130) {
        console.log(address);
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};

export {
    processTransactions, signTxIn, getTransactionId, isValidAddress, validateTransaction,
    UnspentTxOut, TxIn, TxOut, getCoinbaseTransaction, getPublicKey, hasDuplicates,
    Transaction
};
