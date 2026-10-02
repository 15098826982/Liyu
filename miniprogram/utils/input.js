// utils/input.js  文本框聚焦时清空 placeholder，失焦恢复
// 用法：页面 data 里加  ph: { 字段名: '提示文字', ... }
//      input 上：placeholder="{{ph.字段名}}" bindfocus="onFieldFocus" bindblur="onFieldBlur" data-ph="字段名"
// van-field 上：placeholder="{{ph.字段名}}" bind:focus="onFieldFocus" bind:blur="onFieldBlur" data-ph="字段名"
module.exports = {
  onFieldFocus(e) {
    const key = e.currentTarget.dataset.ph;
    if (!key) return;
    if (!this._phCache) this._phCache = {};
    if (!(key in this._phCache)) {
      this._phCache[key] = (this.data.ph && this.data.ph[key]) || '';
    }
    this.setData({ [`ph.${key}`]: '' });
  },
  onFieldBlur(e) {
    const key = e.currentTarget.dataset.ph;
    if (!key || !this._phCache || !(key in this._phCache)) return;
    this.setData({ [`ph.${key}`]: this._phCache[key] || '' });
  }
};
