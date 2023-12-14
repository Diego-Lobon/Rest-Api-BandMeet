const mongoose = require("mongoose");

const connection = async() => {

    try {
        //await mongoose.connect("mongodb://127.0.0.1:27017/mi_redsocial");
        await mongoose.connect("mongodb://mongo:F4A6ABgaffgE1A6bEdA1b2cEAd-GCGd5@viaduct.proxy.rlwy.net:21162");
        console.log("Conectado correctamente a bd: mi_redsocial");

    } catch(error) {
        console.log(error);
        throw new Error("No se ha podido conectar a la base de datos !!");
    }

}

module.exports = connection

