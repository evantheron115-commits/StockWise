const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/postsController');

router.get('/:ticker',  ctrl.getPosts);
router.post('/:ticker', ctrl.createPost);

module.exports = router;
