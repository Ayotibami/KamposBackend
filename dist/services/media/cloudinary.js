"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = uploadImage;
exports.uploadBuffer = uploadBuffer;
exports.deleteByPublicId = deleteByPublicId;
exports.deleteByPublicIdWithType = deleteByPublicIdWithType;
const cloudinary_1 = require("cloudinary");
const env_1 = require("../../config/env");
cloudinary_1.v2.config({
    cloud_name: env_1.env.CLOUDINARY_NAME,
    api_key: env_1.env.CLOUDINARY_API_KEY,
    api_secret: env_1.env.CLOUDINARY_API_SECRET,
});
async function uploadImage(filePath, folder = 'kampos/profiles') {
    return cloudinary_1.v2.uploader.upload(filePath, {
        folder,
        resource_type: 'image',
        overwrite: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });
}
async function uploadBuffer(buffer, folder = 'kampos/profiles') {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: 'auto', overwrite: true, transformation: [{ quality: 'auto', fetch_format: 'auto' }] }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        stream.end(buffer);
    });
}
async function deleteByPublicId(public_id) {
    return cloudinary_1.v2.uploader.destroy(public_id, { invalidate: true, resource_type: 'image' });
}
async function deleteByPublicIdWithType(public_id, resource_type) {
    return cloudinary_1.v2.uploader.destroy(public_id, { invalidate: true, resource_type });
}
