interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: '奔跑着看看世界',
  siteUrl: 'https://wenxiaowan.com',
  logo: 'https://blog.wenxiaowan.com/avatar.jpg',
  description: 'Running Records by Wan',
  navLinks: [
    {
      name: 'Blog',
      url: 'http://home.wenxiaowan.com:18080',
    },
    {
      name: 'TksTo',
      url: 'https://github.com/yihong0618/running_page/blob/master/README-CN.md',
    },
  ],
};

export default data;
