// utils/upload.js  图片选择 + 压缩 + 上传云存储（带限流校验）
const { checkImage } = require('./security');

/**
 * 选择图片并上传到云存储
 * @param {object} opts { type: 'avatar'|'dish', sourceType }
 * @returns {Promise<string|null>} fileID；用户取消或审核不通过返回 null
 */
function chooseAndUpload(opts = {}) {
  const type = opts.type || 'common';
  const showLoading = opts.showLoading !== false;
  return new Promise((resolve) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: opts.sourceType || ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const fileSize = res.tempFiles[0].size || 0;
        if (showLoading) wx.showLoading({ title: '上传中', mask: true });
        try {
          // 1. 先过服务端限流校验
          const checkRes = await wx.cloud.callFunction({
            name: 'upload',
            data: { action: 'check', type, fileSize }
          });
          if (checkRes.result && checkRes.result.code !== 0) {
            if (showLoading) wx.hideLoading();
            wx.showToast({ title: checkRes.result.msg || '上传失败', icon: 'none' });
            resolve(null);
            return;
          }

          // 2. 压缩
          const compressed = await compressImage(tempFilePath);

          // 3. 上传云存储
          const fileID = await uploadFile(compressed || tempFilePath, type);
          if (showLoading) wx.hideLoading();

          // 4. 内容安全审核
          const pass = await checkImage(fileID);
          if (!pass) {
            wx.cloud.deleteFile({ fileList: [fileID] }).catch(() => {});
            wx.showToast({ title: '图片包含违规内容，已拦截', icon: 'none' });
            resolve(null);
            return;
          }

          // 5. 记录上传日志
          wx.cloud.callFunction({
            name: 'upload',
            data: { action: 'record', type, cloudPath: fileID }
          }).catch(() => {});

          resolve(fileID);
        } catch (e) {
          if (showLoading) wx.hideLoading();
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

// 上传到云存储，按 type 分目录
function uploadFile(filePath, type = 'common') {
  const m = filePath.match(/\.(jpg|jpeg|png|webp)$/i);
  const ext = m ? m[1].toLowerCase() : 'png';
  const cloudPath = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: (err) => reject(err)
    });
  });
}

module.exports = { chooseAndUpload, compressImage, uploadFile };
