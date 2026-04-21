'use strict';
const db = require('../db/queries');

async function getPosts(req, res) {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const posts = await db.getPostsByTicker(ticker);
    res.json({ posts });
  } catch (err) {
    console.error('[getPosts]', err.message);
    res.status(500).json({ error: 'Failed to load posts.' });
  }
}

async function createPost(req, res) {
  const secret = req.headers['x-api-secret'];
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const ticker = req.params.ticker.toUpperCase();
  const { content, userId, userName } = req.body || {};

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content is required.' });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: 'Post must be under 1000 characters.' });
  }

  try {
    const post = await db.createPost({
      ticker,
      userId,
      userName: userName || 'Anonymous',
      content: content.trim(),
    });
    res.status(201).json({ post });
  } catch (err) {
    console.error('[createPost]', err.message);
    res.status(500).json({ error: 'Failed to create post.' });
  }
}

module.exports = { getPosts, createPost };
