import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app';

describe('Auth', () => {
  beforeAll(async () => {
    await mongoose.connect('MONGO_URI=mongodb://chatapplication2026_db_user:xRGUoKQUuufImwWr@chat-app-shard-00-00.7hstocw.mongodb.net:27017,chat-app-shard-00-01.7hstocw.mongodb.net:27017,chat-app-shard-00-02.7hstocw.mongodb.net:27017/chatapp?ssl=true&replicaSet=atlas-xxxx-shard-0&authSource=admin&retryWrites=true&w=majority');
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  test('register & login', async () => {
    const username = `user_${Date.now()}`;
    const recoveryEmail = `${username}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'pass123', recoveryEmail });
    expect(res.status).toBe(201);
    expect(res.body.uid).toBeDefined();
    expect(res.body.recoveryEmail).toBe(recoveryEmail);

    const login = await request(app).post('/api/auth/login').send({ username, password: 'pass123' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeDefined();
  }, 10000);

  test('register fails with invalid recoveryEmail', async () => {
    const username = `user_invalid_${Date.now()}`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'pass123', recoveryEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('register rejects duplicate recoveryEmail', async () => {
    const username1 = `user1_${Date.now()}`;
    const username2 = `user2_${Date.now()}`;
    const recoveryEmail = `dup_${Date.now()}@example.com`;

    const r1 = await request(app)
      .post('/api/auth/register')
      .send({ username: username1, password: 'pass123', recoveryEmail });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/auth/register')
      .send({ username: username2, password: 'pass123', recoveryEmail });
    expect(r2.status).toBe(409);
  });
});