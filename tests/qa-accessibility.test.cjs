const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const {colors:c}=load('ui/theme.ts');
function luminance(hex){const values=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722}
function contrast(a,b){const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (l[0]+0.05)/(l[1]+0.05)}
test('main text, labels, actions and warnings meet 4.5:1 contrast in the FoodBuddy palette',()=>{
 for(const [fg,bg] of [[c.green,c.cream],[c.blue,c.cream],[c.muted,c.cream],[c.muted,c.white],[c.white,c.green],[c.white,c.blue],[c.amber,c.softAmber],[c.red,c.softRed],[c.blue,c.softBlue]])assert(contrast(fg,bg)>=4.5,`${fg} on ${bg}`);
});
