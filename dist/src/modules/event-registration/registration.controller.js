import * as Repo from './registration.repo';
export const RegistrationController = {
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
