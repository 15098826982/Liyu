// utils/upload.js  图片选择 + 压缩 + 上传到自己的后端
const { baseURL } = require('./request');

/**
 * 选择图片并上传到后端
 * @param {object} opts { type: 'avatar'|'family'|'dish'|'wish'|'common', sourceType }
 * @returns {Promise<string|null>} 图片 url；用户取消或上传失败返回 null
 */
function chooseAndUpload(opts = {}) {
  const type = opts.type || 'common';
  return new Promise((resolve) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: opts.sourceType || ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中', mask: true });
        try {
          const compressed = await compressImage(tempFilePath);
          const url = await uploadFile(compressed || tempFilePath, type);
          wx.hideLoading();
          resolve(url);
        } catch (e) {
          wx.hideLoading();
          console.error('[upload] 上传失败:', e);
          wx.showToast({ title: '上传失败', icon: 'none' });
          resolve(null);
        }
      },
      fail: () => resolve(null) // 用户取消
    });
  });
}

// 二次压缩图片
function compressImage(filePath) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: filePath,
      quality: 70,
      success: (res) => resolve(res.tempFilePath),
      fail: () => resolve(null)
    });
  });
}

// 上传到后端 POST /upload，type 决定服务端存放目录
function uploadFile(filePath, type = 'common') {
  const token = wx.getStorageSync('token') || '';
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${baseURL}/upload`,
      filePath,
      name: 'file',
      formData: { type },
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0 && data.data && data.data.url) {
            resolve(data.data.url);
          } else {
            reject(new Error(data.msg || '上传失败'));
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject
    });
  });
}

module.exports = { chooseAndUpload, compressImage, uploadFile };
