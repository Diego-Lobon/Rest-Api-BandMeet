const mongoose = require("mongoose");

const connection = async() => {

    try {
        //await mongoose.connect("mongodb://127.0.0.1:27017/mi_redsocial");
        await mongoose.connect("mongodb://mongo:bH5CDe-CAcdE-bb3446fb2h-G342hF-G@monorail.proxy.rlwy.net:26524");
        console.log("Conectado correctamente a bd: mi_redsocial");

    } catch(error) {
        console.log(error);
        throw new Error("No se ha podido conectar a la base de datos !!");
    }

}

module.exports = connection

