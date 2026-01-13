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
exports.ReactionController = void 0;
const repo = __importStar(require("./reaction.repo"));
exports.ReactionController = {
    upsert: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { entity_type, entity_id, type } = req.body || {};
        const r = await repo.upsert({ avitag: req.user.avitag, entity_type, entity_id, type });
        return res.status(201).json({ success: true, data: r });
    },
    listByEntity: async (req, res) => {
        const { entity_type, entity_id } = req.params;
        const data = await repo.listByEntity(entity_type, entity_id);
        return res.json({ success: true, data });
    },
    listByUser: async (req, res) => {
        const { avitag } = req.params;
        const data = await repo.listByUser(avitag);
        return res.json({ success: true, data });
    },
    remove: async (req, res) => {
        const role = req.user?.role;
        const reaction_id = req.params.reaction_id;
        if (role === 'IDIOT') {
            const ok = await repo.removeById(reaction_id);
            if (!ok)
                return res.status(404).json({ success: false, message: 'Reaction not found' });
            return res.json({ success: true, message: 'Deleted' });
        }
        return res.status(403).json({ success: false, message: 'Forbidden' });
    },
    removeByEntity: async (req, res) => {
        if (!req.user?.avitag)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { entity_type, entity_id } = req.params;
        const ok = await repo.removeByComposite(entity_type, entity_id, req.user.avitag);
        if (!ok)
            return res.status(404).json({ success: false, message: 'Reaction not found' });
        return res.json({ success: true, message: 'Deleted' });
    },
};
