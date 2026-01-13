"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountController = void 0;
const account_service_1 = require("./account.service");
exports.AccountController = {
    me: async (req, res) => {
        if (!req.user?.account_id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const data = await account_service_1.AccountService.me(req.user.account_id);
        if (!data)
            return res.status(404).json({ success: false, message: 'Account not found' });
        return res.json({ success: true, data });
    },
    update: async (req, res) => {
        if (!req.user?.account_id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { email } = req.body || {};
        const updated = await account_service_1.AccountService.update(req.user.account_id, { email: email ?? null });
        return res.json({ success: true, data: updated });
    },
    changePassword: async (req, res) => {
        if (!req.user?.account_id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
        }
        await account_service_1.AccountService.changePassword(req.user.account_id, currentPassword, newPassword);
        return res.json({ success: true, message: 'Password changed' });
    },
    delete: async (req, res) => {
        if (!req.user?.account_id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        await account_service_1.AccountService.softDelete(req.user.account_id);
        return res.json({ success: true, message: 'Account deleted' });
    },
};
