import * as hash from 'easy-crypto/hash';

class MerkleTreeNodeGeneric<T> {
  hash: string;

  compare(node: MerkleTreeNodeGeneric<T>) {
    return this.hash === node.hash;
  }
}

class MerkleTreeChildNode<T> extends MerkleTreeNodeGeneric<T> {
  hash: string;

  constructor(public data: T) {
    super();
    this.hash = hash.hash('sha256', JSON.stringify(data), 'utf-8', 'hex');
  }
}

class MerkleTreeNode<T> extends MerkleTreeNodeGeneric<T> {
  hash: string;

  constructor(public leftChild: MerkleTreeNodeGeneric<T>, public rightChild: MerkleTreeNodeGeneric<T>) {
    super();
    this.hash = hash.hash('sha256', leftChild.hash + rightChild.hash, 'hex', 'hex');
  }
}

function generateLevel<T>(nodes: MerkleTreeNodeGeneric<T>[]) {
    console.log('nodessssssssssss', nodes)
  const result: MerkleTreeNodeGeneric<T>[] = [];
  while (nodes.length > 1) {
    const first = nodes.shift();
    const second = nodes.shift();
    result.push(new MerkleTreeNode<T>(first, second));
  }
  if (nodes.length == 1) {
    const last = nodes.shift();
    result.push(new MerkleTreeNode<T>(last, undefined));
  }
  return result;
}

class MerkleTree<T> {
  root: MerkleTreeNodeGeneric<T>;

  constructor(documents: T[]) {
    let nodes: MerkleTreeNodeGeneric<T>[] = documents.map(data => new MerkleTreeChildNode<T>(data));
    console.log('nodeeeeeeeeeeeeee', nodes)
    while (nodes.length > 1) {
      nodes = generateLevel(nodes);
    }
    this.root = nodes[0];
  }

  compare(tree: MerkleTree<T>) {
    return this.root.compare(tree.root);
  }
}

const first = new MerkleTree<string>(['apple', 'banana', 'candy', 'dog','yuna','linus','janet','school']);
// const second = new MerkleTree<string>(['one', 'two', 'three', 'four']);
// const third = new MerkleTree<string>(['one', 'two', 'five', 'four']);

console.log('firsttttttttt', first)

// console.log(first.compare(second));
// console.log(first.compare(third));