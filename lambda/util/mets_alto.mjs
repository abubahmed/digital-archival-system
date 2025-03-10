export const generateAltoFile = (pageText, pageId) => {
  const builder = new xml2js.Builder();
  const altoObject = {
    "alto:alto": {
      $: {
        xmlns: "http://www.loc.gov/standards/alto/ns-v4#",
      },
      "alto:layout": {
        "alto:Page": [
          {
            $: {
              ID: `page_${pageId}`,
              PHYSICAL_IMG_NR: pageId.toString(),
              HEIGHT: "1050",
              WIDTH: "800",
            },
            "alto:TextBlock": [
              {
                $: {
                  ID: `tb_${pageId}`,
                  HPOS: "100",
                  VPOS: "100",
                  HEIGHT: "200",
                  WIDTH: "600",
                },
                "alto:textLine": [
                  {
                    $: {
                      HPOS: "100",
                      VPOS: "100",
                      HEIGHT: "20",
                      WIDTH: "500",
                    },
                    "alto:String": {
                      _: pageText,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
  return builder.buildObject(altoObject);
};
