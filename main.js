// ページデータの定義
class Passage {
    #origID; // 入力時のページ番号
    #newID;  // 出力時のページ番号
    #txt;    // ページ本文
    
    constructor(id_, txt_) {
        this.#origID = id_;
        this.#newID = null;
        this.#txt = txt_;
    }

    // 本文中に現れる [jump:**] タグによる遷移先リストを返す
    searchNextPassageIndices() {
        const regexJump = /\[jump:[0-9]+\]/g;
        var jumpTags = this.#txt.match(regexJump);

        if(jumpTags === null) {
            jumpTags = [];
        }

        // 重複を削除
        jumpTags = Array.from(new Set(jumpTags));

        var indices = [];
        for(const tag of jumpTags) {
            const nextID = Number(tag.substring(6, tag.length - 1));
            indices.push(nextID);
        }

        return indices;
    }

    // 本文中に現れる [jump:**] タグを指定のページ番号リストで上書きする
    updateNextPassagePageNumbers(indices_) {
        const regexJump = /\[jump:[0-9]+\]/g;
        var jumpTags = this.#txt.match(regexJump);

        if(jumpTags === null) {
            jumpTags = [];
        }

        // 重複を削除
        jumpTags = Array.from(new Set(jumpTags));

        const tagNum = jumpTags.length;
        if(indices_.length != tagNum) {
            console.error(`ERROR in updateNextPassagePageNumbers() : input length (${indices_.length}) differs from the number of the jump tags (${tagNum}). input:${indices_}, jump tags:${jumpTags}.`);
        }

        // 置き換えの前後で番号が衝突しないよう一時的に大きな番号で書き換え
        var indicesPlaceHolders = [];
        for(const index of indices_) {
            indicesPlaceHolders.push(100000000 + index);
        }

        for(let tagI = 0; tagI < tagNum; ++tagI) {
            const curTagRegex = new RegExp("\\[" + jumpTags[tagI].substring(1, jumpTags[tagI].length - 1) + "\\]", 'g');
            const newTag = "[jump:" + String(indicesPlaceHolders[tagI]) + "]";

            this.#txt = this.#txt.replace(curTagRegex, newTag);
        }

        // 大きな番号から置き換え
        for(let tagI = 0; tagI < tagNum; ++tagI) {
            const placeHoldedTagRegex = new RegExp("\\[jump:" + indicesPlaceHolders[tagI] + "\\]", 'g');
            const newTag = "[jump:" + String(indices_[tagI]) + "]";

            this.#txt = this.#txt.replace(placeHoldedTagRegex, newTag);
        }
    }

    setOriginalID(id_) {
        this.#origID = id_;
    }

    getOriginalID() {
        return this.#origID;
    }

    setNewID(id_) {
        this.#newID = id_;
    }

    getNewID() {
        return this.#newID;
    }

    setText(txt_) {
        this.#txt = txt_;
    }

    getText() {
        return this.#txt;
    }
}

// ページ並べ替え用のキュー
class Queue {
    #array = [];

    enqueue(x) {
        this.#array.push(x);
    }

    dequeue() {
        if(!(this.empty())) {
            return this.#array.shift();
        }
        return null;
    }

    size() {
        return this.#array.length;
    }

    empty() {
        return (this.size() <= 0);
    }
}

// 変換処理メイン
function convertMain(input) {
    // 入力テキストをページ単位に分割
    var passages = [];
    var pageZero = new Passage(0,null); // 配列添字とページ番号を一致させるために空の0ページ目を保持
    passages.push(pageZero);

    const pages = input.split("[newpage]");
    pages.forEach((page, index) => {
        index = index + 1; // ページIDは1からカウント
        console.log(`[page: ${index}]\n${page}`);

        var passage = new Passage(index, page);
        passages.push(passage);
    })

    // 入力テキストのページ数が0や1の場合（0ページ目を含めて1や2の場合）は入力をそのまま返す
    if(passages.length == 1 || passages.length == 2) {
        return input;
    }

    // ページを選択肢での登場順に並び替える
    var sortedPassages = [];
    sortedPassages.push(pageZero);

    var que = new Queue();
    que.enqueue(1); // 第1ページから探索開始
    var pageCount = 1; // 新しく割り振るページID
    while(!(que.empty())) {
        const currentID = que.dequeue();
        var currentPassage = passages[currentID];

        // 第2ページ目を飛ばしてページ番号を割り振る
        if(pageCount == 2) {
            pageCount++;
        }
        currentPassage.setNewID(pageCount++);

        sortedPassages.push(currentPassage);

        // 選択肢を走査
        const nextIndices = currentPassage.searchNextPassageIndices();
        for(const nextID of nextIndices) {
            // 存在しないページ参照はエラー
            if(nextID >= passages.length) {
                console.error(`ERROR: page ${currentID} reffers unexist page ${nextID}.`);
                continue;
            }
            
            // 未探索の場合はキューに追加
            if(passages[nextID].getNewID() === null) {
                que.enqueue(nextID);
            }
        }
    }

    // 2ページ目を挿入
    var pageSecond = new Passage(null, "\n");
    pageSecond.setNewID(2);
    sortedPassages.splice(2, 0, pageSecond);

    // 各ページ本文中の [jump:**] タグを新しいページ番号で書き換える
    for(const passage of sortedPassages) {
        if(passage.getNewID() === null) {
            continue;
        }

        const nextIndicesCur = passage.searchNextPassageIndices();
        var nextIndicesNew = [];

        // 遷移先の番号を新しい番号に更新
        for(const nextID of nextIndicesCur) {
            nextIndicesNew.push(passages[nextID].getNewID());
        }

        passage.updateNextPassagePageNumbers(nextIndicesNew);
    }

    // Passageリストをひとつのテキストに結合
    var output = "";
    const sortedPageNum = sortedPassages.length - 1; // 表示しない0ページ目分を差し引く
    for(let pageI = 1; pageI <= sortedPageNum; ++pageI) {
        var pageText = sortedPassages[pageI].getText();

        if(pageI == 1) {
            output = pageText;
        } else {
            output = output + "[newpage]" + pageText;
        }
    }

    return output;
}