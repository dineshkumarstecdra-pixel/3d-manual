Project file support update

Replace these files in your project:

admin.html
server.js
vite.config.js
package.json
src/admin.js
src/car-details.js
src/home.js
src/index.js
src/partscat.js
src/serviceman.js

Supported upload storage:
- Car image: jpg, jpeg, png, svg, webp
- Model file: stp, step, stl, glb, gltf, obj, dwg, dxf, fbx
- Model data: xlsx, xls, csv
- Service manual: pdf, xlsx, xls, doc, docx, ppt, pptx, txt

3D viewer preview support:
- Direct preview: glb, gltf, obj, stl, fbx
- Stored but not directly previewed in browser: stp, step, dwg, dxf
  Convert these CAD formats to glb/obj/stl/fbx for viewer preview.

Run:
npm install
npm run upload-server
npm run dev
