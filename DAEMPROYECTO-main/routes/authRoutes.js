const express = require("express");
const AuthController = require("../controllers/AuthController");
const autenticar = require("../middleware/auth");

const router = express.Router();
const controller = new AuthController();

router.post("/login", (req, res) => controller.login(req, res));
router.get("/me", autenticar, (req, res) => controller.perfil(req, res));

module.exports = router;