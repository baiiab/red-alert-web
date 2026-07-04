export class BinaryHeap {
  constructor(scoreFunc) {
    this.content = [];
    this.scoreFunc = scoreFunc;
  }

  push(element) {
    this.content.push(element);
    this._bubbleUp(this.content.length - 1);
  }

  pop() {
    const result = this.content[0];
    const end = this.content.pop();
    if (this.content.length > 0) {
      this.content[0] = end;
      this._sinkDown(0);
    }
    return result;
  }

  remove(node) {
    const len = this.content.length;
    for (let i = 0; i < len; i++) {
      if (this.content[i] === node) {
        const end = this.content.pop();
        if (i !== len - 1) {
          this.content[i] = end;
          if (this.scoreFunc(end) < this.scoreFunc(node)) this._bubbleUp(i);
          else this._sinkDown(i);
        }
        return;
      }
    }
  }

  size() {
    return this.content.length;
  }

  _bubbleUp(n) {
    const element = this.content[n];
    while (n > 0) {
      const parentN = Math.floor((n + 1) / 2) - 1;
      const parent = this.content[parentN];
      if (this.scoreFunc(element) < this.scoreFunc(parent)) {
        this.content[parentN] = element;
        this.content[n] = parent;
        n = parentN;
      } else break;
    }
  }

  _sinkDown(n) {
    const length = this.content.length;
    const element = this.content[n];
    while (true) {
      const child2N = (n + 1) * 2;
      const child1N = child2N - 1;
      let swap = -1;
      let child1Score, child2Score;
      if (child1N < length) {
        const child1 = this.content[child1N];
        child1Score = this.scoreFunc(child1);
        if (child1Score < this.scoreFunc(element)) swap = child1N;
      }
      if (child2N < length) {
        const child2 = this.content[child2N];
        child2Score = this.scoreFunc(child2);
        if (child2Score < (swap === -1 ? this.scoreFunc(element) : child1Score)) swap = child2N;
      }
      if (swap === -1) break;
      this.content[n] = this.content[swap];
      this.content[swap] = element;
      n = swap;
    }
  }
}
