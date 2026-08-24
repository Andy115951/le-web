module.exports = async function handler(req, res) {
  const { handleBeginnerReadingPolishRequest } = await import("../../lib/beginner-reading-polish.mjs");
  return handleBeginnerReadingPolishRequest(req, res);
};
