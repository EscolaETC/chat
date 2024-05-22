const express = require("express");
const cors = require("cors");
const http = require("http");
const socketio = require("socket.io")
const jwt = require("jsonwebtoken");

const database = require('./db');
const User = require('./user');
const Message = require("./message");

const app = express();
const server = http.createServer(app);
const io = new socketio.Server(server);
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

(async () => {
    await database.sync();
})()

io.on('connection', async (socket) => {
    console.log('a user connected');

    socket.emit("server_messages", await Message.findAll())
    
    socket.on("client_message", async (data) => {
        const resultadoCreate = await Message.create({
            username: data.username,
            message: data.message,
        })

        io.emit("server_new_message", { username: resultadoCreate.dataValues.username, message: resultadoCreate.dataValues.message });
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

const CreateToken = (id) => {
    const token = jwt.sign({ id }, "secret", {
        expiresIn: 86400,
    })

    return token
}

const VerifyToken = (request, response, next) => {
    try {
        const token = request.headers.token;

        if (token === null || token === undefined || token === "" || token === "null"){
            return response.status(400).send({ error: "Token must be provided"});
        }

        jwt.verify(token, "secret", (err, decoded) => {
            if (err) return response.status(400).send({ error: "Invalid token" });

            response.locals.user = decoded;
            return next();
        });
    } catch (error) {
        return response.status(400).send({ error: "Token validation error" });
    }
}

const router = express.Router();

router.get("/login-by-token", VerifyToken, async (request, response) => {
    console.log(response.locals.user);

    const exists = await User.findAll({
        where: {
            id: response.locals.user.id
        }
    });

    if (exists.length == 0){
        return response.status(400).send({error: "User not found"});
    }

    return response.status(200).send({ user: exists[0].dataValues });
});

router.post("/login", async (request, response) => {
    const exists = await User.findAll({
        where: {
            username: request.body.username
        }
    });

    if (exists.length == 0){
        return response.status(400).send({error: "User not found"});
    }

    if (exists[0].dataValues.password != request.body.password){
        return response.status(400).send({error: "Incorrect user or password"});
    }

    const token = CreateToken(exists[0].dataValues.id);

    return response.status(200).send({ user: exists[0].dataValues, token });
})

router.post("/register", async (request, response) => {
    const exists = await User.findAll({
        where: {
            username: request.body.username
        }
    });

    if (exists.length != 0){
        return response.status(400).send({error: "User already exists"});
    }

    const resultadoCreate = await User.create({
        username: request.body.username,
        password: request.body.password,
    })

    const token = CreateToken(resultadoCreate.dataValues.id);

    return response.status(200).send({ user: resultadoCreate.dataValues, token });
})

app.use(router);

server.listen(PORT, () => {
    console.log("Server is running at port: ", PORT);
})