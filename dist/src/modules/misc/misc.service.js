import * as CampusesRepo from './misc.repo';
export const getAllCampuses = async () => {
    return CampusesRepo.getAllCampuses();
};
export const getAllMajors = async () => {
    return CampusesRepo.getAllMajors();
};
