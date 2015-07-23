(function($){

    var ChatAutoComplete = function(input, emoticons) {
        var self = this;
        var keyMap = [];

        if (!input || input.length == 0 || !input[0].setSelectionRange)
            return this;

        this.minWordLength = 2;
        this.maxResults    = 10;
        this.buckets       = {};
        this.origVal       = null;
        this.searchResults = [];
        this.searchIndex   = -1;
        this.searchWord    = null;
        this.input         = $(input);
        this.expireUsers   = $.proxy(this.expireUsers, this);

        for (var i = emoticons.length - 1; i >= 0; i--)
            this.addEmote(emoticons[i]);

        setInterval(this.expireUsers, 300000); // 5 minutes
        this.input.on({
            mousedown: function(e) {
                self.resetSearch();
            },
            keydown: function(e) {
                e = e || event;
                keyMap[e.keyCode] = e.type == 'keydown';
                if (keyMap[9] && keyMap[16]) { // Shift+Tab
                    if (self.searchResults.length <= 0) {
                        self.resetSearch();
                        self.searchSelectWord(true);
                    }
                    self.showAutoComplete();
                    return false;
                }else if (keyMap[9]) { // if TAB
                    if (self.searchResults.length <= 0) {
                        self.resetSearch();
                        self.searchSelectWord(false);
                    }
                    self.showAutoComplete();
                    return false;
                }

                // Cancel the search and continue the keydown
                self.resetSearch();
                return true;
            }
        });

        return this;
    };
    ChatAutoComplete.prototype.getBucketId = function(str) {
        if (str.length == 0)
            return "";

        return str[0].toLowerCase();
    };
    ChatAutoComplete.prototype.addToBucket = function(data, weight, isemote, ispromoted) {
        if (!this.input)
            return;

        var id = this.getBucketId(data);

        if(!this.buckets[id])
            this.buckets[id] = {};

        if (!this.buckets[id][data])
            this.buckets[id][data] = {
                data: data,
                weight: weight,
                isemote: !!isemote,
                ispromoted: !!ispromoted
            };

        return this.buckets[id][data];
    };
    ChatAutoComplete.prototype.addEmote = function(emote){
        this.addToBucket(emote, 1, true, false);

        return this;
    };
    ChatAutoComplete.prototype.addNick = function(nick) {
        this.addToBucket(nick, 1, false, false);

        return this;
    };
    ChatAutoComplete.prototype.updateNick = function(nick) {
        if (!this.input)
            return;

        var weight = Date.now();
        var data = this.addToBucket(nick, weight, false, false);

        data.weight = weight;
        return this;
    };
    ChatAutoComplete.prototype.promoteNick = function(nick) {
        var weight = Date.now();
        var data = this.addToBucket(nick, weight, false, false);

        if (data.isemote)
            return this;

        data.weight = weight;
        data.ispromoted = true;
        return this;
    };

    ChatAutoComplete.prototype.getSearchWord = function(str, offset) {
        var pre          = str.substring(0, offset),
            post         = str.substring(offset),
            startCaret   = pre.lastIndexOf(" ") + 1,
            endCaret     = post.indexOf(" "),
            isUserSearch = false;

        if (startCaret > 0)
            pre = pre.substring(startCaret);

        if (endCaret > -1)
            post = post.substring(0, endCaret);

        // Ignore the first char as part of the search and flag as a user only search
        if(pre.lastIndexOf("@") === 0){
            startCaret++;
            pre = pre.substring(1);
            isUserSearch = true;
        }

        return {
            word: pre + post,
            startCaret: startCaret,
            isUserSearch: isUserSearch
        };
    };
    ChatAutoComplete.prototype.sortResults = function(a, b) {
        // order promoted things first
        if (a.ispromoted != b.ispromoted)
            return a.ispromoted && !b.ispromoted? -1: 1;

        // order emotes second
        if (a.isemote != b.isemote)
            return a.isemote && !b.isemote? -1: 1;

        // order according to recency third
        if (a.weight != b.weight)
            return a.weight > b.weight? -1: 1;

        // order lexically fourth
        var a = a.data.toLowerCase(),
            b = b.data.toLowerCase();

        if (a == b)
            return 0;

        return a > b? 1: -1;
    };
    ChatAutoComplete.prototype.searchBuckets = function(str, limit, usernamesOnly) {
        // escape the text being inserted into the regexp
        str = str.trim().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        var res  = [],
            f    = new RegExp("^"+str, "i"),
            data = this.buckets[this.getBucketId(str)] || {};
        
        for (var nick in data) {
            if (!data.hasOwnProperty(nick) || (usernamesOnly && data[nick].isemote))
                continue;

            if (f.test(nick))
                res.push(data[nick]);
        }

        res.sort(this.sortResults);
        return res.slice(0, limit);
    };
    ChatAutoComplete.prototype.expireUsers = function() {
        // if the user hasnt spoken in the last 5 minutes, reset the weight
        // so that emotes can be ordered before the user again
        var fiveminutesago = Date.now() - 300000;
        for (var i in this.buckets) {
            if (!this.buckets.hasOwnProperty(i))
                continue;

            for(var j in this.buckets[i]) {
                if (!this.buckets[i].hasOwnProperty(j))
                    continue;

                var data = this.buckets[i][j];
                if (data.isemote || data.weight > fiveminutesago)
                    continue;

                data.weight = 1;
                data.ispromoted = false;
            };
        };
    };
    ChatAutoComplete.prototype.markLastComplete = function() {
        if(!this.lastComplete)
            return

        var data = this.buckets[this.getBucketId(this.lastComplete)] || {};
        if (!data[this.lastComplete] || data[this.lastComplete].isemote)
            return this.lastComplete = null;

        this.promoteNick(this.lastComplete);
        this.lastComplete = null;
    };
    ChatAutoComplete.prototype.resetSearch = function() {
        this.origVal       = null;
        this.searchResults = [];
        this.searchIndex   = -1;
        this.searchWord    = null;
    };
    ChatAutoComplete.prototype.searchSelectWord = function(weow) {
        var searchWord = this.getSearchWord(this.input.val(), this.input[0].selectionStart);
        if (searchWord.word.length >= this.minWordLength){
            this.searchWord    = searchWord;
            if (weow) {
                this.searchResults = this.searchBuckets(this.searchWord.word, this.maxResults, true);
            } else {
                this.searchResults = this.searchBuckets(this.searchWord.word, this.maxResults, this.searchWord.isUserSearch);
            }
            this.origVal       = this.input.val();
        }
    };
    ChatAutoComplete.prototype.showAutoComplete = function() {
        if (this.searchIndex >= this.searchResults.length - 1)
            this.searchIndex = 0;
        else
            this.searchIndex = this.searchIndex + 1;

        var result = this.searchResults[this.searchIndex];
        if (!result || result.data == this.searchWord.word)
            return;

        this.lastComplete = result.data;
        var pre  = this.origVal.substr(0, this.searchWord.startCaret),
            post = this.origVal.substr(this.searchWord.startCaret + this.searchWord.word.length);

        // always add a space after our completion if there isn't one since people
        // would add one anyway
        if (post[0] != " " || post.length == 0)
            post = " " + post;

        this.input.focus().val(pre + result.data + post);

        // Move the caret to the end of the replacement string + 1 for the space
        this.input[0].setSelectionRange(pre.length + result.data.length + 1, pre.length + result.data.length + 1);
        return true;
    };

    window.ChatAutoComplete = ChatAutoComplete;

})(jQuery);