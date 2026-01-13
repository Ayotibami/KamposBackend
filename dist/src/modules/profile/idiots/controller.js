import * as repo from './repo';
import { uploadBuffer } from '../../../services/media/cloudinary';
import { env } from '../../../config/env';
export const create = async (req, res) => {
    if (!req.user?.account_id)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { avitag, display_name, description, image_url } = req.body || {};
    if (!avitag || !display_name) {
        return res.status(400).json({ success: false, message: 'avitag and display_name are required' });
    }
    let finalUrl = null;
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = file?.data;
        if (buffer) {
            const uploaded = await uploadBuffer(buffer, `kampos/profiles/${avitag}`);
            finalUrl = uploaded.secure_url || uploaded.url || null;
        }
    }
    if (!finalUrl && image_url)
        finalUrl = image_url;
    if (!finalUrl && env.DEFAULT_PROFILE_PIC_URL)
        finalUrl = env.DEFAULT_PROFILE_PIC_URL;
    try {
        const created = await repo.create({
            avitag,
            account_id: req.user.account_id,
            display_name,
            description: description ?? null,
            image_url: finalUrl ?? null,
        });
        return res.status(201).json({ success: true, data: created });
    }
    catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ success: false, message: 'An idiot profile already exists for this account.' });
        }
        return res.status(500).json({ success: false, message: 'Failed to create idiot profile' });
    }
};
export const get = async (req, res) => {
    const p = await repo.findByAvitag(req.params.avitag);
    if (!p || p.profile_status !== 'ACTIVE')
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data: p });
};
export const list = async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const data = await repo.listActive(limit, offset);
    return res.json({ success: true, data });
};
export const update = async (req, res) => {
    if (!req.user?.account_id)
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    const existing = await repo.findByAvitag(req.params.avitag);
    if (!existing)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    if (existing.account_id !== req.user.account_id && req.user.role !== 'IDIOT') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const updates = { ...req.body };
    const filesAny = req.files;
    if (filesAny && filesAny.image) {
        const file = Array.isArray(filesAny.image) ? filesAny.image[0] : filesAny.image;
        const buffer = file?.data;
        if (buffer) {
            const uploaded = await uploadBuffer(buffer, `kampos/profiles/${existing.avitag}`);
            updates.image_url = uploaded.secure_url || uploaded.url || null;
        }
    }
    const updated = await repo.update(existing.avitag, existing.account_id, updates);
    if (!updated)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data: updated });
};
export const verify = async (req, res) => {
    const ok = await repo.setVerified(req.params.avitag, true);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Verified' });
};
export const remove = async (req, res) => {
    const ok = await repo.remove(req.params.avitag);
    if (!ok)
        return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, message: 'Deleted' });
};
