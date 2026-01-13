export const notFound = (req, res) => {
    return res.status(404).json({ success: false, message: 'Not Found' });
};
export const errorHandler = (err, _req, res, _next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    return res.status(status).json({ success: false, message });
};
