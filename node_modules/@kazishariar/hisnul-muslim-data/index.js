import data from './data.json' with { type: 'json' };

export const getMeta = () => data.meta;
export const getData = () => data.data || data.sections;
export default { getMeta, getData, data };
