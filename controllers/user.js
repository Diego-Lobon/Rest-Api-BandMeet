// Importar dependecias y modulos
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

// Importar modelos
const User = require("../models/user");
const Follow = require("../models/follow");
const Publication = require("../models/publication");

// Importar servicios
const jwt = require("../services/jwt");
const { Schema, default: mongoose } = require("mongoose");
const { exit } = require("process");
const validate = require("../helpers/validate");

const followService = require("../services/followService");
const follow = require("../models/follow");

// Acciones de prueba
const pruebaUser = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controller/user.js",
        usuario: req.user  
    });
}

// Registro de usuarios
const register = (req, res) => {
    // Recoger datos de la peticion
    let params = req.body;

    // Comprobar que me llegan bien (+ validacion)
    if (!params.name || !params.email || !params.password || !params.nick){
        return res.status(400).json({
            status: "Error",
            message: "Faltan datos por enviar",
        });
    }

    // Validacion avanzada
    try {
        
        validate(params);

    } catch (error) {
        
        return res.status(400).json({
            status: "Error",
            message: "Validacion no superada",
        });

    }
    
    // Control usuarios duplicados
    User.find({ 
        $or: [
            { email: params.email.toLowerCase() },
            { nick: params.nick }
        ]
    }).exec().then(async (users) => {

        if (users && users.length >= 1){
            return res.status(200).send({
                status: "Success",
                message: "El usuario ya existe"
            });
        }
        
        // Cifrar la contraseña
        let pwd = await bcrypt.hash(params.password, 10)
        params.password = pwd;
        
        // Crer objeto de usuario
        let user_to_save = new User(params);

        // Guardar usuario en la bd
        user_to_save.save().then((userStored) => {            
            // Devolver resultado
            return res.status(200).json({
                status: "Success",
                message: "Usuario registrado correctamente",
                user: userStored
            });
        }).catch((error) => {
            return res.status(500).json({status: "Error", message: "Error al guardar el usuario"})
        });     
    }).catch((error) => {
        return res.status(500).json({status: "Error", message: "Error en la consulta"})
    });
}

const login = (req, res) => {

    // Recoger parametros body
    let params = req.body;

    // Buscar en la bbdd si existe
    User.findOne({email: params.email})

    if (!params.email || !params.password){
        return res.status(400).send({
            status: "Error",
            message: "Faltan datos por enviar"
        })
    }

    // Buscar en la bbdd si existe
    User.findOne({ email: params.email })
        //.select({"password": 0})
    .then((user) => {
        if (!user){
            return res.status(404).send({ status: "error", message: "No existe el usuario" });
        }
        
        // Comprobar su contraseña 
        let pwd = bcrypt.compareSync(params.password, user.password)
        
        if (!pwd){
            return res.status(400).send({
                status: "Error",
                message: "No te has identificado correctamente"
            })
        }

        // Conseguir Token
        const token = jwt.createToken(user);

        // Devolver datos del usuario
        return res.status(200).send({
            status: "Success",
            message: "Te has identificado correctamente",
            user: {
                id: user._id,
                name: user.name,
                nick: user.nick
            },
            token
        });
    }).catch((error) => {
        return res.status(500).json({status: "Error", message: "Error en la consulta de la base de datos"})
    });
    
}

const profile = async (req, res) => {
    // Recibir el parametro del id del usuario por la url
    const id = req.params.id;
    
    User.findById(id ? id : null)
    .select({password: 0, role: 0})    
    .then(async (userProfile) => {

        // Info de seguimiento
        const followInfo = await followService.followThisUser(req.user.id, id);

        // Devolver el resultado
        // Posteriormente: devolver información de follows
        return res.status(200).send({
            status: "Success",
            user: userProfile,
            following: followInfo.following,
            follower: followInfo.follower
        });

    }).catch((error) => {
        return res.status(500).send({
            status: "Error",
            user: "El usuario no existe o hay un error"
        });
    });
}

const list = async (req, res) => {
    const defaultPage = 1;
    const page = req.params.page ? parseInt(req.params.page) : defaultPage;
    let itemsPerPage = 5;
   
    const options = {
        page: page,
        limit: itemsPerPage,
        sort: { _id: 1}, 
        collation: {
            locale: "en",
        },
        select: '-password -email -role -__v'
    };
   
    try{
        const users = await User.paginate({},options)
        if(!users)
        return res.status(404).json({
            status: "Error",
            message: "No se han encontrado usuarios",
        });

        // Sacar un array de ids de los usuarios que me siguen y los que sigan
        let followUserIds = await followService.followUserIds(req.user.id);
        
        // Devolver el resultado (posteriormente info follow)
        return res.status(200).send({
            status: "Success",
            message: "listado de usuarios",
            users: users.docs,
            page,
            itemsPerPage,
            total: users.totalDocs,
            pages: users.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers
        });
    } catch (error){
        return res.status(404).json({
            status: "Error",
            message: "Hubo un error al obtener los usuarios",
            error: error.message,
        });
    }  
}

const update = (req, res) => {
    // Recoger info del usuario a actualizar
    let userIdentity = req.user;
    let userToUpdate = req.body;

    // Eliminar campos sobrantes
    delete userToUpdate.iat;
    delete userToUpdate.exp;
    delete userToUpdate.role;
    delete userToUpdate.image;

    // Comprobar si el usuario ya existe
    // Control usuarios duplicados
    User.find({ 
        $or: [
            { email: userToUpdate.email.toLowerCase() },
            { nick: userToUpdate.nick }
        ]
    }).exec().then(async (users) => {

        let userIsset = false;
        users.forEach(user => {
            if (user && user._id != userIdentity.id) userIsset = true;
        })

        
        if (userIsset){
            return res.status(200).send({
                status: "Success",
                message: "El usuario ya existe"
            });
        }
        

        // Cifrar la contraseña
        if (userToUpdate.password) {
            let pwd = await bcrypt.hash(userToUpdate.password, 10)
            userToUpdate.password = pwd;
        } else {
            delete userToUpdate.password;
        }

        // Buscar y actualizar
        try {

            let userUpdated = await User.findByIdAndUpdate({_id: userIdentity.id}, userToUpdate, {new: true});

            if(!userUpdated){
                return res.status(400).json({status: "Error", message: "Error al actualizar"})
            }

            // Devolver respuesta
            return res.status(200).send({
                status: "Success",
                message: "Metodo de actualizar usuario",
                user: userUpdated
            });

        } catch (error) {
            return res.status(500).send({
                status: "Error",
                message: "Error al actualizar"
            });
        }
    }).catch((error) => {
        return res.status(500).json({status: "Error", message: "Error en la consulta", error: error.message})
    });  
}

const upload = (req, res) => {

    // Recoger el fichero de imagen y comprobar que existe
    if(!req.file) {
        return res.status(400).send({
            status: "Error",
            message: "Peticion no incluye la imagen"
        });
    }

    // Conseguir el nombre del archivo
    let image = req.file.originalname;

    // Sacar la extension del archivo
    const imageSplit = image.split("\.");
    const extension = imageSplit[1];

    // Comprobar extension
    if(extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif"){
        
        // Borrar archivo subido
        const filePath = req.file.path;
        const fileDeleted =  fs.unlinkSync(filePath);

        // Devolver respuesta negativa
        return res.status(400).send({
            status: "Error",
            message: "Extension del fichero invalida"
        });

    }

    // SI no es correcto, borrar archivo
    User.findOneAndUpdate({ _id: req.user.id }, { image: req.file.filename }, { new: true })
    .then((userUpdated) => {
        if (!userUpdated) {
            return res.status(500).send({
                status: "Error",
                message: "Error en la subida del avatar"
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "Success",
            user: userUpdated,
            file: req.file,
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "Error en la subida del avatar"
        });
    });
    
}

const avatar = (req, res) => {
    // Sacar el parametro de la url
    const file = req.params.file;

    // Montar el path real de la imagen
    const filePath = "./uploads/avatars/" + file;

    // Comprobar que existe
    fs.stat(filePath, (error, exists) => {

        if(!exists) {
            return res.status(404).send({
                status: "Error",
                message: "No existe la imagen"
            });
        }
        
        // Devolver un file
        return res.sendFile(path.resolve(filePath));

    });
}

const counters = async (req, res) => {
    
    let userId = req.params.id;

    if (req.params.id) {
        userId = req.params.id;
    }

    try {
        
        const following = await Follow.count({ "user": userId });
        const followed = await Follow.count({ "followed": userId });
        const publications = await Publication.count({ "user": userId });

        return res.status(200).send({
            status: "Success",
            following: following,
            followed: followed,
            publications: publications
        });

    } catch (error) {
        return res.status(500).send({
            status: "Error",
            message: "Error en los contadores"
        });
    }

}

// Exportar acciones
module.exports = {
    pruebaUser,
    register,
    login,
    profile,
    list,
    update,
    upload,
    avatar,
    counters
}

