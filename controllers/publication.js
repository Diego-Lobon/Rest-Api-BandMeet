// Importar modelos
const Publication = require("../models/publication");

// Importar modulos
const fs = require("fs");
const path = require("path");

// Importar servicios
const followService = require("../services/followService");

// Acciones de prueba
const pruebaPublication = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controller/user.js"  
    });
}

// Guardar publication
const save = (req, res) => {

    // Recoger datos del body
    const params = req.body;

    // SI no me llega dar respuesta negativa
    if(!params.text) {
        return res.status(400).send({
            status: "Error",
            message: "Debes enviar el texto de la publicacion"  
        });
    }

    // Crear y rellenar el objeto del modelo
    let newPublication = new Publication(params);
    newPublication.user = req.user.id;

    // Guardar objeto en bbdd
    newPublication.save()
    .then((publicationStored) => {
        if (!publicationStored) {
            return res.status(400).send({
                status: "Error",
                message: "No se ha guardado la publicacion"
            });
        }
        // Devolver respuesta
        return res.status(200).send({
            status: "Success",
            message: "Publicacion guardada",
            publicationStored
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "No se ha guardado la publicacion",
            error: error.message
        });
    });

    
}

// Sacar una publicacion
const detail = (req, res) => {

    // Sacar id de la publicacion de la url
    const publicationId = req.params.id;

    // Find con la condicion del id
    Publication.findById(publicationId).exec()
    .then((publicationStored) => {
        if (!publicationStored) {
            return res.status(404).send({
                status: "Error",
                message: "No existe la publicacion",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "Success",
            message: "Mostrar publicacion",
            Publication: publicationStored
        });
    })
    .catch((error) => {
        return res.status(404).send({
            status: "Error",
            message: "No existe la publicacion",
        });
    });

}

// Eliminar publicaciones
const remove = (req, res) => {

    //Sacar el id de la publicacion a eliminar
    const publicationId = req.params.id;

    // Find y luego un remove
    Publication.deleteOne({"user": req.user.id, "_id": publicationId})
    .then((result) => {
        if (!result) {
            return res.status(500).send({
                status: "Error",
                message: "No se ha eliminado la publicacion",
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "Success",
            message: "Eliminar publicacion",
            publication: publicationId
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "No se ha eliminado la publicacion",
        });
    });   
}

// Listar publicaciones de un usuario
const user = (req, res) => {

    // Sacar el id de usuario
    let userId = req.params.id;

    // Controlar la pagina
    let page = 1;

    if(req.params.page){
        page = req.params.page
    }

    const itemsPerPage = 5;

    // Find, populate, ordenar, paginar
    // Utilizar el método de paginación de mongoose-paginate-v2
    Publication.paginate({ user: userId }, { page: page, limit: itemsPerPage, sort: { created_at: -1 }, populate: { path: 'user', select: '-password -role -__v -email' }})
        .then((result) => {
            const { docs: publications, totalDocs: total, totalPages: pages } = result;

            if (publications.length === 0) {
                return res.status(404).send({
                    status: "Error",
                    message: "No hay publicaciones para mostrar",
                });
            }

            return res.status(200).send({
                status: "Success",
                message: "Publicaciones del perfil de un usuario",
                page,
                total,
                pages,
                publications
            });
        })
        .catch((error) => {
            return res.status(500).send({
                status: "Error",
                message: "Ha ocurrido un error al obtener las publicaciones",
            });
        });
};

// Subir ficheros
const upload = (req, res) => {

    // Sacar publication id
    const publicationId = req.params.id;

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
    Publication.findOneAndUpdate({ "user": req.user.id, "_id": publicationId }, { file: req.file.filename }, { new: true })
    .then((publicationUpdated) => {
        if (!publicationUpdated) {
            return res.status(500).send({
                status: "Error",
                message: "Error en la subida del avatar"
            });
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "Success",
            publication: publicationUpdated,
            file: req.file,
        });
    })
    .catch((error) => {
        return res.status(500).send({
            status: "Error",
            message: "Error en la subida del avatar"
        });
    });
};

// Devolver archivos multimedia imagenes
const media = (req, res) => {
    // Sacar el parametro de la url
    const file = req.params.file;

    // Montar el path real de la imagen
    const filePath = "./uploads/publications/" + file;

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

// Listar todas las publicaciones (FEED)
const feed = async (req, res) => {

    // Sacar la pagina actual
    let page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    // Establecer numero de elementos por pagina
    let itemsPerPage = 5;

    // Sacar un array de identificadores de usuarios que yo sigo como usuario logueado
    try {
        const myFollows = await followService.followUserIds(req.user.id);

        const options = {
            page: page,
            limit: itemsPerPage,
            sort: { created_at: -1 },
            populate: { path: 'user', select: '-password -role -__v -email' }
        };

        const publications = await Publication.paginate({ user: { $in: myFollows.following } }, options);

        if(!publications){
            return res.status(500).send({
                status: "Error",
                message: "No hay publicaciones para mostrar",
                error: error.message
            });
        }

        return res.status(200).send({
            status: "Success",
            message: "Feed de publicaciones",
            following: myFollows.following,
            total: publications.totalDocs,
            page: publications.page,
            pages: publications.totalPages,
            publications: publications.docs
        });
    } catch (error) {
        return res.status(500).send({
            status: "Error",
            message: "No se han listado las publicaciones del feed",
            error: error.message
        });
    }
}

// Exportar acciones
module.exports = {
    pruebaPublication,
    save,
    detail,
    remove,
    user,
    upload,
    media,
    feed
}