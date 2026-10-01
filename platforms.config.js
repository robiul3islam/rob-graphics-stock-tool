// ONE PLACE to edit CSV formats. Each column is [header, source].
// source = a field name, or "=literal" for a fixed value.
// Fields: filename, title, description, descriptionOrTitle, keywords, aiPrompt, aiModel, isVector
// verified:false shows a "check against the current template" warning in the UI.
export const PLATFORMS={
  adobe:{name:'Adobe Stock',verified:true,delimiter:',',kwSeparator:', ',titleMax:70,descMax:200,kwMax:49,
    columns:[['Filename','filename'],['Title','title'],['Keywords','keywords'],['Category','='],['Releases','=']]},
  shutterstock:{name:'Shutterstock',verified:true,delimiter:',',kwSeparator:', ',titleMax:70,descMax:200,kwMax:49,
    columns:[['Filename','filename'],['Description','descriptionOrTitle'],['Keywords','keywords'],['Categories','='],['Editorial','=no'],['Mature content','=no'],['illustration','isVector']]},
  freepik:{name:'Freepik',verified:true,delimiter:';',kwSeparator:',',titleMax:70,descMax:200,kwMax:49,
    columns:[['File name','filename'],['Title','title'],['Keywords','keywords'],['Prompt','aiPrompt'],['Model','aiModel']]},
  vecteezy:{name:'Vecteezy',verified:false,delimiter:',',kwSeparator:', ',titleMax:70,descMax:200,kwMax:49,
    columns:[['Filename','filename'],['Title','title'],['Description','description'],['Keywords','keywords']]},
  dreamstime:{name:'Dreamstime',verified:false,delimiter:',',kwSeparator:', ',titleMax:70,descMax:200,kwMax:49,
    columns:[['Filename','filename'],['Title','title'],['Description','description'],['Keywords','keywords']]}
};
