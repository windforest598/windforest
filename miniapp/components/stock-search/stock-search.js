// ═══════════════════════════════════════
// 股票搜索组件逻辑
// ═══════════════════════════════════════

var STOCK_DB = require('../../utils/stocks.js');

Component({
  properties: {
    placeholder: { type: String, value: '输入股票代码或名称…' }
  },

  data: {
    query: '',
    suggestions: [],
    showSuggestions: false,
    selectedIndex: -1
  },

  methods: {
    // ── 输入事件 ──
    onInput: function(e) {
      var q = e.detail.value.replace(/\s+/g, '');
      this.setData({ query: q, selectedIndex: -1 });

      if (q.length < 1) {
        this.setData({ suggestions: [], showSuggestions: false });
        return;
      }

      // 模糊搜索
      var results = [];
      var qLower = q.toLowerCase();
      for (var i = 0; i < STOCK_DB.length && results.length < 12; i++) {
        var s = STOCK_DB[i];
        if (s.c.indexOf(qLower) !== -1 || s.n.indexOf(q) !== -1 || (s.s && s.s.indexOf(q) !== -1)) {
          results.push(s);
        }
      }

      this.setData({
        suggestions: results,
        showSuggestions: results.length > 0
      });
    },

    onFocus: function() {
      if (this.data.suggestions.length > 0) {
        this.setData({ showSuggestions: true });
      }
    },

    onClear: function() {
      this.setData({ query: '', suggestions: [], showSuggestions: false });
    },

    onConfirm: function() {
      var list = this.data.suggestions;
      if (list.length > 0) {
        var idx = this.data.selectedIndex >= 0 ? this.data.selectedIndex : 0;
        this.selectStock(list[idx]);
      }
    },

    // ── 选择股票 ──
    onSelect: function(e) {
      var idx = e.currentTarget.dataset.index;
      var stock = this.data.suggestions[idx];
      if (stock) this.selectStock(stock);
    },

    selectStock: function(stock) {
      this.setData({ showSuggestions: false });
      this.triggerEvent('select', {
        code: stock.c.replace(/^(sh|sz|bj|hk|us)/, ''),
        market: stock.m,
        name: stock.n,
        fullCode: stock.c
      });
    }
  }
});
