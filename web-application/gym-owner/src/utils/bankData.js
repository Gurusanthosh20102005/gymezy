import bankJson from '../../bankjson.json';

export const BANKS = Object.values(bankJson.banks_in_tamil_nadu)
  .flat()
  .filter((bank) => bank?.name && bank?.ifsc_prefix)
  .map((bank) => ({
    name: bank.name,
    ifscPrefix: bank.ifsc_prefix,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

export const getBankByName = (name) =>
  BANKS.find((bank) => bank.name === name);
