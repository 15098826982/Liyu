// components/top-bar/index.js  顶部信息栏：相恋天数 + 纪念日倒计时（仅显示）
const { api } = require('../../utils/request');
const { thumb } = require('../../utils/img');

Component({
  data: {
    family: {},
    coverUrl: '',
    loveDays: 0,
    daysToNext: 0,
    nextAnniversary: ''
  },

  lifetimes: {
    attached() {
      this.loadFamily();
    }
  },

  methods: {
    async loadFamily() {
      try {
        const { family } = await api('family', 'getInfo', {}, { showLoading: false });
        if (family) {
          this.setData({ family });
          this.computeDates(family);
          this.loadCover(family.coverImage);
        }
      } catch (e) {}
    },

    // 顶栏背景是通栏大图，按 bg 规格取缩略图；失败兜底原图临时 URL
    async loadCover(coverImage) {
      if (!coverImage) {
        this.setData({ coverUrl: '' });
        return;
      }
      if (coverImage.indexOf('cloud://') !== 0) {
        // 非 cloud:// 的路径（如本地路径）直接用
        this.setData({ coverUrl: coverImage });
        return;
      }
      let url = await thumb(coverImage, 'bg');
      if (!url || url === coverImage || url.indexOf('http') !== 0) {
        try {
          const res = await wx.cloud.getTempFileURL({ fileList: [coverImage] });
          url = (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) || '';
        } catch (e) {}
      }
      if (url) this.setData({ coverUrl: url });
    },

    // 缩略图 URL 失效时兜底：换回原图临时 URL（同一个只重试一次）
    async onCoverError() {
      const cur = this.data.coverUrl;
      if (!cur || this.coverFallbackUrl === cur) return;
      this.coverFallbackUrl = cur;
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [this.data.family.coverImage] });
        const raw = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
        if (raw && raw !== cur) this.setData({ coverUrl: raw });
      } catch (e) {}
    },

    computeDates(family) {
      const now = new Date();
      const data = {};

      if (family.loveStartDate) {
        const start = new Date(family.loveStartDate);
        data.loveDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      } else {
        data.loveDays = 0;
      }

      if (family.anniversaryDate) {
        const ann = new Date(family.anniversaryDate);
        const next = new Date(now.getFullYear(), ann.getMonth(), ann.getDate());
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        data.daysToNext = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
        data.nextAnniversary = `${ann.getMonth() + 1}月${ann.getDate()}日`;
      } else {
        data.daysToNext = 0;
      }

      this.setData(data);
    }
  }
});
