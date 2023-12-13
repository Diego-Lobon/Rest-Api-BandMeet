// Importar modelo
const Follow = require("../models/follow");

// Importar servicio
const followService = require("../services/followService")

// Importar dependencias

// Acciones de prueba
const pruebaFollow = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controller/user.js"  
    });
}

// Accion de guardar un follow (accion seguir)
const save = (req, res) => {

    // Conseguir datos por body
    const params = req.body;

    // Sacar id del usuario identificado
    const identity = req.user;

    // Crear objeto con modelo follow
    let userToFollow = new Follow({
        user: identity.id,
        followed: params.followed
    });

    // Guardar objeto en bbdd
    userToFollow.save()
    .then((followStored) => {
        if (!followStored) {
            return res.status(500).send({
                status: "Error",
                message: "No se ha podido seguir al usuario"
            });
        }

        return res.status(200).send({
            status: "Success",
            identity: req.user,
            follow: followStored
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "No se ha podido seguir al usuario"
        });
    });
};

// Accion de borrar un follow (accion dejar de seguir)
const unfollow = (req, res) => {
    // Recoger el id del usuario identificado
    const userId = req.user.id;

    // Recoger el id del usuario que sigo y quiero dejar seguir
    const followedId = req.params.id;

    // Find de las coincidencias y hacer remove
    Follow.deleteOne({ "user": userId, "followed": followedId })
    .then((followDeleted) => {
        if (!followDeleted) {
            return res.status(500).send({
                status: "Error",
                message: "No has dejado de seguir a nadie"
            });
        }

        return res.status(200).send({
            status: "Success",
            message: "Follow eliminado correctamente",
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "No has dejado de seguir a nadie"
        });
    });

    
}

// Accion listado de usuarios que cualquier usuario esta siguiendo
const following = async (req, res) => {

    // Sacar el id del usuario identificado
    let userId = req.user.id;

    // Comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id;

    // Comprobar si me llega la pagina, si no la pagina 1
    let page = 1;

    if(req.params.page) page = req.params.page;

    // Usuarios por pagina quiero mostrar
    const itemsPerPage = 5;

    // Find a follow, popular datos de los usuarios y paginar con mongoose paginate v2
    // Metodo #2
    // opciones de la paginacion

    try {

        const query = { user: userId };
        const options = {
            select: "name password",
            page: page,
            limit: itemsPerPage,
            sort: { created_at: -1 },
            // populate: "user followed",
            populate: [{
                path: "user followed",
                select: "-password -role -__v -email"
            }],
            collation: {
                locale: "es",
            },
        };

        // Sacar un array de ids de los usuarios que me siguen y los que sigan
        let followUserIds = await followService.followUserIds(req.user.id);
        
    
        const follows = await Follow.paginate(query, options);
    
        return res.status(200).send({
            status: "Success",
            message: "Listado de usuarios que estoy siguiendo",
            userId,
            follows: follows.docs,
            total: follows.totalDocs,
            pages: follows.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers
        });

    } catch (error) {
        return res.status(500).send({
            status: "Success",
            message: "Error al listar usuarios que estoy siguiendo",
        });
    }

    //

    
}


// Accion listado de usuarios que siguen a cualquier otro usuario
const followers = async (req, res) => {

    // Sacar el id del usuario identificado
    let userId = req.user.id;

    // Comprobar si me llega el id por parametro en url
    if(req.params.id) userId = req.params.id;

    // Comprobar si me llega la pagina, si no la pagina 1
    let page = 1;

    if(req.params.page) page = req.params.page;

    // Usuarios por pagina quiero mostrar
    const itemsPerPage = 5;

    try {

        const query = { followed: userId };
        const options = {
            select: "name password",
            page: page,
            limit: itemsPerPage,
            sort: { created_at: -1 },
            populate: [{
                path: "user",
                select: "-password -role -__v -email"
            }],
            collation: {
                locale: "es",
            },
        };

        // Sacar un array de ids de los usuarios que me siguen y los que sigan
        let followUserIds = await followService.followUserIds(req.user.id);
        
    
        const follows = await Follow.paginate(query, options);
    
        return res.status(200).send({
            status: "Success",
            message: "Listado de usuarios que me siguen",
            follows: follows.docs,
            total: follows.totalDocs,
            pages: follows.totalPages,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers
        });

    } catch (error) {
        return res.status(500).send({
            status: "Success",
            message: "Error al listar usuarios que estoy siguiendo",
        });
    }
}


// Exportar acciones
module.exports = {
    pruebaFollow,
    save,
    unfollow,
    following,
    followers
}