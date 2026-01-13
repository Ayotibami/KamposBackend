"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationController = void 0;
const Repo = __importStar(require("./registration.repo"));
exports.RegistrationController = {
    register: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { event_id } = req.body || {};
        if (!event_id)
            return res.status(400).json({ success: false, message: 'event_id required' });
        const row = await Repo.register(event_id, req.user.avitag);
        return res.status(201).json({ success: true, data: row });
    },
    listByEvent: async (req, res) => {
        const { event_id } = req.params;
        const data = await Repo.listByEvent(event_id);
        return res.json({ success: true, data });
    },
    listByStudent: async (req, res) => {
        const { avitag } = req.params;
        const data = await Repo.listByStudent(avitag);
        return res.json({ success: true, data });
    },
    unregister: async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ success: false, message: 'invalid id' });
        const ok = await Repo.unregister(id);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Not found' });
        return res.json({ success: true, message: 'Unregistered' });
    },
};
