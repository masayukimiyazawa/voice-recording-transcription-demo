// @vonage/jwt のテスト用モック
module.exports = {
  tokenGenerate: jest.fn(() => 'mock-jwt-token'),
};
