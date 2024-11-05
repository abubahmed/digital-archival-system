import fs from "fs";
import client from "https";

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    client.get(url, (res) => {
      if (res.statusCode === 200) {
        res
          .pipe(fs.createWriteStream(filepath))
          .on("error", reject)
          .once("close", () => resolve(filepath));
      } else {
        res.resume();
        reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
      }
    });
  });
}

const webUrls = [
  "https://scontent-lga3-1.cdninstagram.com/v/t39.30808-6/464529711_1108855261246758_1298139656921430503_n.jpg?stp=dst-jpg_e35&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMDgweDEwODAuc2RyLmYzMDgwOC5kZWZhdWx0X2ltYWdlIn0&_nc_ht=scontent-lga3-1.cdninstagram.com&_nc_cat=106&_nc_ohc=IJigWvBonogQ7kNvgGaSyHt&_nc_gid=4dfb479233b249f3a7ca4d4bd1155a8d&edm=APoiHPcAAAAA&ccb=7-5&ig_cache_key=MzQ4NzQ2Njc2MDYxMTY4OTg0Mw%3D%3D.3-ccb7-5&oh=00_AYCPcR18MDI248R5jZzODIIDyTsGStLdwDXXUOheNRkwqA&oe=672F26A2&_nc_sid=22de04",
  "https://scontent-lga3-2.cdninstagram.com/v/t39.30808-6/464638246_1108855364580081_5024949201145619674_n.jpg?stp=dst-jpg_e35&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMDgweDEwODAuc2RyLmYzMDgwOC5kZWZhdWx0X2ltYWdlIn0&_nc_ht=scontent-lga3-2.cdninstagram.com&_nc_cat=109&_nc_ohc=i49IroVB44cQ7kNvgGNUUfU&_nc_gid=4dfb479233b249f3a7ca4d4bd1155a8d&edm=APoiHPcAAAAA&ccb=7-5&ig_cache_key=MzQ4NzQ2Njc2MDE4Mzg0MDcyMw%3D%3D.3-ccb7-5&oh=00_AYB9t4IT31IQzSsszAKjCuaLNpwcALyjbO7eruvfidKumg&oe=672F169F&_nc_sid=22de04",
  "https://scontent-lga3-2.cdninstagram.com/v/t39.30808-6/464562544_1108855217913429_5220976436756628362_n.jpg?stp=dst-jpg_e35&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMDgweDEwODAuc2RyLmYzMDgwOC5kZWZhdWx0X2ltYWdlIn0&_nc_ht=scontent-lga3-2.cdninstagram.com&_nc_cat=109&_nc_ohc=oA3RiRmTJrQQ7kNvgGl4P2j&_nc_gid=4dfb479233b249f3a7ca4d4bd1155a8d&edm=APoiHPcAAAAA&ccb=7-5&ig_cache_key=MzQ4NzQ2Njc1OTY5NzMyNDA3MQ%3D%3D.3-ccb7-5&oh=00_AYCNcG8tOJCifnoWJuG6qyY_r1EV1j4FuZR_nM52Fy863g&oe=672F0913&_nc_sid=22de04",
];

await downloadImage(webUrls[0], "image1.jpg");
await downloadImage(webUrls[1], "image2.jpg");
