import * as gistRepo from './gist.repo';

export const GistService = {
  submit: (params: {
    gist_text: string;
    avitag: string;
    campus_tag?: string | null;
    major_tag?: string | null;
    level?: number | null;
  }) => gistRepo.createGist(params),

  findById: (id: string) => gistRepo.findGistById(id),
};
