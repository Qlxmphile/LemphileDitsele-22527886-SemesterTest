# GMT320 Semester Test 2 — Lemphile LefalakaaDitselee 22527886

## Repository Overview
This repository contains my practical implementation for Question 2 and 3 of GMT320 Semester Test 2.

### Structure
├── index.html # Main HTML interface
├── main.js # CesiumJS application logic
├── SemTest.glb # Exported 3D campus model
├── *.dbf # Attribute data tables

└── README.md # Project documentation

markdown
Copy code

### Main Branch (`main`)
- Forked from the group’s main repository.
- Contains all base web application code and features demonstrated in Demo 1 without any modifications from Demo 1.

### Branch: `additional-features`
- Adds:
  1. Height Visualizer: Color buildings based on height (Green → Yellow → Red).
  2. Building Search: Search by name and automatically fly camera to result.
  3. 3D Basemap & Terrain Integration: Uses Cesium World Terrain via Ion token for realistic surroundings.

### Data and Layers
All GIS layers used in this project are stored in my Google Drive:
👉 [Google Drive Layers Folder] --> https://drive.google.com/drive/folders/1TUocw_9hmOdV8jc_QnCdUts0lNuUj_1m?usp=drive_link

Contents:
- LiDAR point cloud (`up_lidar.las`)
- Digital Terrain Model (DTM)
- Normalized DSM (nDSM)
- Orthophoto (`up_campus.tif`)
- Shapefiles (`up_campus_aoi.shp`, building footprints)
- Attribute tables (`.dbf` files)

### Technologies
- CesiumJS for 3D visualization  
- QGIS for data preparation  
- Chart.js for attribute visualization  
- Git & GitHub for version control  

### Author
**Lemphile Lefalaka Ditsele**  
Student No:22527886

GMT320 – Semester Test 2
