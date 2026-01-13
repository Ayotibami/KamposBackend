import * as CampusesService from './misc.service';
export const getAllCampuses = async (req, res) => {
    try {
        const campuses = await CampusesService.getAllCampuses();
        res.json({ success: true, data: campuses });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Failed to fetch campuses' });
    }
};
export const getAllMajors = async (req, res) => {
    try {
        const majors = await CampusesService.getAllMajors();
        res.json({ success: true, data: majors });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch majors' });
    }
};
