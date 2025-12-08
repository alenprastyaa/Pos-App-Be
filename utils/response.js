module.exports = {
    success: (res, message, data = null, code = 200) => {
        return res.status(code).json({
            success: true,
            message,
            data
        });
    },

    error: (res, message, code = 500, errors = null) => {
        return res.status(code).json({
            success: false,
            message,
            errors
        });
    }
};
