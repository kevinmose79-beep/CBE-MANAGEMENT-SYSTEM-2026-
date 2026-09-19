import rawJsPDF from 'jspdf';

export let lastDocPageCount = 0;
export function setLastDocPageCount(count: number) {
  lastDocPageCount = count;
}

const origConstructor = (rawJsPDF as any).jsPDF || (rawJsPDF as any).default || rawJsPDF;

function InterceptedJsPDF(this: any, ...args: any[]) {
  const doc = new origConstructor(...args);
  const origSave = doc.save;
  doc.save = function (...sArgs: any[]) {
    if (doc.internal && typeof doc.internal.getNumberOfPages === 'function') {
      lastDocPageCount = doc.internal.getNumberOfPages();
    }
    return doc;
  };
  return doc;
}
InterceptedJsPDF.prototype = origConstructor.prototype;

if ((rawJsPDF as any).jsPDF) {
  (rawJsPDF as any).jsPDF = InterceptedJsPDF;
}
if ((rawJsPDF as any).default) {
  (rawJsPDF as any).default = InterceptedJsPDF;
}
