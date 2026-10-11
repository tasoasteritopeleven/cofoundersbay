import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { experienceSummary, fromLinkedInExport, fromLinkedInRecords, parseCsv, parseCsvRows } from '@cofounderbay/shared';
import { readZipText } from './zip';
import { readLinkedInFiles } from './read-files';

const PROFILE_CSV = [
  'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers',
  'Elena,Papadopoulou,,"Odos 1, Athens",1990-01-01,"Founder, Harbor","Building booking tools for clinics.\nTwo exits.",Software,11111,"Athens, Greece",[elena],"[COMPANY:https://harbor.example],[PERSONAL:https://elena.example]",[skype:elena]',
].join('\n');
const POSITIONS_CSV = 'Company Name,Title,Description,Location,Started On,Finished On\nHarbor,Co-founder,"Clinic bookings, end to end",Athens,Jan 2024,\nAcme,Product lead,,London,Mar 2019,Dec 2023\n';
const SKILLS_CSV = 'Name\nProduct Management\nSales\nProduct Management\n';
const EDUCATION_CSV = 'School Name,Start Date,End Date,Notes,Degree Name,Activities\nNTUA,2008,2013,,MEng,\n';

/** A ZIP built the way LinkedIn's export is: deflated entries in a folder. */
function zipOf(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const deflated = new Uint8Array(deflateRawSync(data));
    const local = new Uint8Array(30 + nameBytes.length + deflated.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, deflated.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(deflated, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, deflated.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    all.set(part, at);
    at += part.length;
  }
  return all.buffer;
}

describe('CSV', () => {
  it('handles quotes, doubled quotes and newlines inside quotes', () => {
    expect(parseCsvRows('a,"b, c","d ""e"""\n1,"two\nlines",3')).toEqual([['a', 'b, c', 'd "e"'], ['1', 'two\nlines', '3']]);
  });

  it('skips a notes preamble before the header it expects', () => {
    expect(parseCsv('Notes:\n"When exporting your connection data, ..."\n\nFirst Name,Company\nSofia,Aegis\n', ['First Name'])).toEqual([{ 'First Name': 'Sofia', Company: 'Aegis' }]);
  });
});

describe('LinkedIn import', () => {
  it('reads the profile, positions, education and skills, and nothing private', () => {
    const imp = fromLinkedInExport({ 'Profile.csv': PROFILE_CSV, 'Positions.csv': POSITIONS_CSV, 'Skills.csv': SKILLS_CSV, 'Education.csv': EDUCATION_CSV });
    expect(imp).toMatchObject({
      displayName: 'Elena Papadopoulou',
      headline: 'Founder, Harbor',
      bio: 'Building booking tools for clinics.\nTwo exits.',
      location: 'Athens, Greece',
      websiteUrl: 'https://harbor.example',
      industry: 'Software',
      skills: ['Product Management', 'Sales'],
    });
    expect(imp.positions).toEqual([
      { company: 'Harbor', title: 'Co-founder', startedOn: 'Jan 2024', finishedOn: '', location: 'Athens', description: 'Clinic bookings, end to end' },
      { company: 'Acme', title: 'Product lead', startedOn: 'Mar 2019', finishedOn: 'Dec 2023', location: 'London', description: '' },
    ]);
    expect(imp.education).toEqual([{ school: 'NTUA', degree: 'MEng', startDate: '2008', endDate: '2013' }]);
    const serialized = JSON.stringify(imp);
    for (const secret of ['1990-01-01', 'Odos 1', '11111', 'skype']) expect(serialized).not.toContain(secret);
    expect(experienceSummary(imp)).toBe('Co-founder · Harbor (Jan 2024–)\nProduct lead · Acme (Mar 2019–Dec 2023)');
  });

  it('reads DMA snapshot rows, which carry the export’s own column names', () => {
    const imp = fromLinkedInRecords({ profile: [{ 'First Name': 'Giorgos', 'Last Name': 'V.', Headline: 'Angel' }], skills: [{ Name: 'Fundraising' }] });
    expect(imp).toMatchObject({ displayName: 'Giorgos V.', headline: 'Angel', skills: ['Fundraising'] });
  });

  it('opens the export ZIP in the browser and reads only the four files a profile uses', async () => {
    const buffer = zipOf({ 'Basic_LinkedInDataExport/Profile.csv': PROFILE_CSV, 'Basic_LinkedInDataExport/Skills.csv': SKILLS_CSV, 'Basic_LinkedInDataExport/messages.csv': 'secret,stuff' });
    const texts = await readZipText(buffer, (p) => /profile\.csv$|skills\.csv$/i.test(p));
    expect(Object.keys(texts).sort()).toEqual(['Basic_LinkedInDataExport/Profile.csv', 'Basic_LinkedInDataExport/Skills.csv']);
    const file = new File([buffer], 'Basic_LinkedInDataExport.zip', { type: 'application/zip' });
    const imp = await readLinkedInFiles([file]);
    expect(imp.displayName).toBe('Elena Papadopoulou');
    expect(imp.skills).toEqual(['Product Management', 'Sales']);
  });
});
