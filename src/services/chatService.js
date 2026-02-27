const chatRepo = require('../db/chatRepository');

const getOrCreatePrivateChat = async (userIdA, userIdB) => {
  let chat = await chatRepo.findByMembers(userIdA, userIdB);
  if (!chat) {
    chat = await chatRepo.create([userIdA, userIdB]);
  }
  return chat;
};

module.exports = { getOrCreatePrivateChat };
