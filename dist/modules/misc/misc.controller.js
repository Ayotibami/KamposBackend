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
exports.getAllMajors = exports.getAllCampuses = void 0;
const CampusesService = __importStar(require("./misc.service"));
const getAllCampuses = async (req, res) => {
    try {
        const campuses = await CampusesService.getAllCampuses();
        res.json({ success: true, data: campuses });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Failed to fetch campuses' });
    }
};
exports.getAllCampuses = getAllCampuses;
const getAllMajors = async (req, res) => {
    try {
        const majors = await CampusesService.getAllMajors();
        res.json({ success: true, data: majors });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch majors' });
    }
};
exports.getAllMajors = getAllMajors;
