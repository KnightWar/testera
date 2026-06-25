const XLSX = require('/Users/digenrai/Downloads/Candidate_Profiler/testera/node_modules/xlsx');
const path = require('path');

const templatesDir = '/Users/digenrai/Downloads/Candidate_Profiler/templates';

function verify(file) {
  console.log('Verifying:', file);
  const wb = XLSX.readFile(path.join(templatesDir, file));
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log('Sheet Name:', sheetName);
  console.log('Rows count:', data.length);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('-------------------------------------------');
}

verify('student_template.xlsx');
verify('question_template.xlsx');
