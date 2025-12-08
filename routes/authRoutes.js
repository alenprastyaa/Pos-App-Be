const express = require('express')
const { register, login, GetUser, updateUser, deleteUser, getMyData } = require('../controllers/Auth')
const { verifyToken } = require('../middleware/verifyToken')
const router = express.Router()


router.post("/auth/register", register)
router.post("/auth/login", login)
router.get("/", verifyToken, GetUser)
router.get("/my/data", verifyToken, getMyData)
router.put("/:id", verifyToken, updateUser)
router.delete("/:id", verifyToken, deleteUser)
// router.get("/", verifyToken, authorizeRole("superadmin"), GetUser);
module.exports = router