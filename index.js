var authConfig = {
    "siteName": "GD仓库",
    "client_id": "202264815644.apps.googleusercontent.com",
    "client_secret": "X4Z3ca8xfWDb1Voo-Fsd53xJ",
    "refresh_token": "",
    "root": ""
};

/** http basic auth **/
// https://tool.oschina.net/encrypt?type=3
// gd:example
const authorization = "Basic Z2Q6ZXhhbXBsZQ==";
/** http basic auth **/
var gd;
addEventListener('fetch', event => {
  console.log(event.request.headers.get("Authorization"));
  if (event.request.headers.get("Authorization") !== authorization) {
    return event.respondWith(new Response(
      null, {
        status: 401,
        statusText: "'Authentication required.'",
        body: "Unauthorized",
        headers: {
          "WWW-Authenticate": 'Basic realm="User Visible Realm"'
        }
      }
    ))
  }
  event.respondWith(handleRequest(event.request))
})

//时间转换
function utc2beijing(utc_datetime) {
    // 转为正常的时间格式 年-月-日 时:分:秒
    var T_pos = utc_datetime.indexOf('T');
    var Z_pos = utc_datetime.indexOf('Z');
    var year_month_day = utc_datetime.substr(0,T_pos);
    var hour_minute_second = utc_datetime.substr(T_pos+1,Z_pos-T_pos-1);
    var new_datetime = year_month_day+" "+hour_minute_second; // 2017-03-31 08:02:06

    // 处理成为时间戳
    timestamp = new Date(Date.parse(new_datetime));
    timestamp = timestamp.getTime();
    timestamp = timestamp/1000;

    // 增加8个小时，北京时间比utc时间多八个时区
    var unixtimestamp = timestamp+8*60*60;

    // 时间戳转为时间
    var unixtimestamp = new Date(unixtimestamp*1000);
        var year = 1900 + unixtimestamp.getYear();
        var month = "0" + (unixtimestamp.getMonth() + 1);
        var date = "0" + unixtimestamp.getDate();
        var hour = "0" + unixtimestamp.getHours();
        var minute = "0" + unixtimestamp.getMinutes();
        var second = "0" + unixtimestamp.getSeconds();
        return year + "-" + month.substring(month.length-2, month.length)  + "-" + date.substring(date.length-2, date.length)
            + " " + hour.substring(hour.length-2, hour.length) + ":"
            + minute.substring(minute.length-2, minute.length) + ":"
            + second.substring(second.length-2, second.length);
} 

// bytes自适应转换到KB,MB,GB
function formatFileSize(bytes) {
	if (bytes>=1000000000) {bytes=(bytes/1000000000).toFixed(2)+' GB';}
        else if (bytes>=1000000)    {bytes=(bytes/1000000).toFixed(2)+' MB';}
        else if (bytes>=1000)       {bytes=(bytes/1000).toFixed(2)+' KB';}
        else if (bytes>1)           {bytes=bytes+' bytes';}
        else if (bytes==1)          {bytes=bytes+' byte';}
        else                        {bytes='0 byte';}
        return bytes;
}
/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
    if(gd == undefined){
      gd = new googleDrive(authConfig);
    }

    // if(request.method == 'POST'){
    //   return apiRequest(request);
    // }

    let url = new URL(request.url);
    let path = url.pathname;

    if(path.substr(-1) == '/'){
      let list = await gd.list(path);
      let v = new view();
      let html = v.list(path, list);
      return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}});
    }else{
      let file = await gd.file(path);
      let range = request.headers.get('Range');
      return gd.down(file.id, range);
      return new Response(JSON.stringify(file));
    }
}

class googleDrive {
    constructor(authConfig) {
        this.authConfig = authConfig;
        this.paths = [];
        this.files = [];
        this.paths["/"] = authConfig.root;
        this.accessToken();
    }

    async down(id, range=''){
      let url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
      let requestOption = await this.requestOption();
      requestOption.headers['Range'] = range;
      return await fetch(url, requestOption);
    }

    async file(path){
      if(typeof this.files[path] == 'undefined'){
        this.files[path]  = await this._file(path);
      }
      return this.files[path] ;
    }

    async _file(path){
      let arr = path.split('/');
      let name = arr.pop();
      name = decodeURIComponent(name);
      let dir = arr.join('/')+'/';
      console.log(name, dir);
      let parent = await this.findPathId(dir);
      console.log(parent);
      let url = 'https://www.googleapis.com/drive/v3/files';
      let params = {'includeItemsFromAllDrives':true,'supportsAllDrives':true};
      params.q = `'${parent}' in parents and name = '${name}' andtrashed = false`;
      params.fields = "files(id, name, mimeType, size ,createdTime, modifiedTime, iconLink, thumbnailLink)";
      url += '?'+this.enQuery(params);
      let requestOption = await this.requestOption();
      let response = await fetch(url, requestOption);
      let obj = await response.json();
      console.log(obj);
      return obj.files[0];
    }

    // 通过reqeust cache 来缓存
    async list(path){
      let id = await this.findPathId(path);
      return this._ls(id);
    }

    async _ls(parent){
      console.log("_ls",parent);

      if(parent==undefined){
        return null;
      }
      let url = 'https://www.googleapis.com/drive/v3/files';
      let params = {'includeItemsFromAllDrives':true,'supportsAllDrives':true};
      params.q = `'${parent}' in parents and trashed = false`;
      params.orderBy= 'folder,name,modifiedTime desc';
      params.fields = "nextPageToken, files(id, name, mimeType, size , modifiedTime)";
      params.pageSize = 1000;
      url += '?'+this.enQuery(params);
      let requestOption = await this.requestOption();
      let response = await fetch(url, requestOption);
      let obj = await response.json();
      return obj;
    }

    async findPathId(path){
      let c_path = '/';
      let c_id = this.paths[c_path];

      let arr = path.trim('/').split('/');
      for(let name of arr){
        c_path += name+'/';

        if(typeof this.paths[c_path] == 'undefined'){
          let id = await this._findDirId(c_id, name);
          this.paths[c_path] = id;
        }

        c_id = this.paths[c_path];
        if(c_id == undefined || c_id == null){
          break;
        }
      }
      console.log(this.paths);
      return this.paths[path];
    }

    async _findDirId(parent, name){
      name = decodeURIComponent(name);
      
      console.log("_findDirId",parent,name);

      if(parent==undefined){
        return null;
      }

      let url = 'https://www.googleapis.com/drive/v3/files';
      let params = {'includeItemsFromAllDrives':true,'supportsAllDrives':true};
      params.q = `'${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}'  and trashed = false`;
      params.fields = "nextPageToken, files(id, name, mimeType)";
      url += '?'+this.enQuery(params);
      let requestOption = await this.requestOption();
      let response = await fetch(url, requestOption);
      let obj = await response.json();
      if(obj.files[0] == undefined){
        return null;
      }
      return obj.files[0].id;
    }

    async accessToken(){
      console.log("accessToken");
      if(this.authConfig.expires == undefined  ||this.authConfig.expires< Date.now()){
        const obj = await this.fetchAccessToken();
        if(obj.access_token != undefined){
          this.authConfig.accessToken = obj.access_token;
          this.authConfig.expires = Date.now()+3500*1000;
        }
      }
      return this.authConfig.accessToken;
    }

    async fetchAccessToken() {
        console.log("fetchAccessToken");
        const url = "https://www.googleapis.com/oauth2/v4/token";
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const post_data = {
            'client_id': this.authConfig.client_id,
            'client_secret': this.authConfig.client_secret,
            'refresh_token': this.authConfig.refresh_token,
            'grant_type': 'refresh_token'
        }

        let requestOption = {
            'method': 'POST',
            'headers': headers,
            'body': this.enQuery(post_data)
        };

        const response = await fetch(url, requestOption);
        return await response.json();
    }

    async fetch200(url, requestOption) {
        let response;
        for (let i = 0; i < 3; i++) {
            response = await fetch(url, requestOption);
            console.log(response.status);
            if (response.status != 403) {
                break;
            }
            await this.sleep(800 * (i + 1));
        }
        return response;
    }

    async requestOption(headers={},method='GET'){
      const accessToken = await this.accessToken();
      headers['authorization'] = 'Bearer '+ accessToken;
      return {'method': method, 'headers':headers};
    }

    enQuery(data) {
        const ret = [];
        for (let d in data) {
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
        }
        return ret.join('&');
    }

    sleep(ms) {
        return new Promise(function (resolve, reject) {
            let i = 0;
            setTimeout(function () {
                console.log('sleep' + ms);
                i++;
                if (i >= 2) reject(new Error('i>=2'));
                else resolve(i);
            }, ms);
        })
    }
}

class view{

  nav(path){
    let html = ``;
    let arr = path.trim('/').split('/');
    var p = '/';
    if(arr.length > 0){
      for(let n of arr){
        p += n+'/';
        if(n == ''){
          break;
        }
	n = decodeURIComponent(n);
        html += `<i class="mdui-icon material-icons mdui-icon-dark" style="margin:0;">chevron_right</i>
        <a href="${p}">${n}</a>`;
      }
    }
		return html;
  }

  ls(path, items){
    let html = `<div class="mdui-row">
	<ul class="mdui-list">
		<li class="mdui-list-item th">
		  <div class="mdui-col-xs-12 mdui-col-sm-7">文件</div>
		  <div class="mdui-col-sm-3 mdui-text-right">修改时间</div>
		  <div class="mdui-col-sm-2 mdui-text-right">大小</div>
		</li>`;
    
    for(let item of items){
      console.log(item);
      let p = path+item.name+'/';
      let d = new Date(item['modifiedTime']);
	  item['modifiedTime'] = utc2beijing(item['modifiedTime']);
      if(item['size']==undefined){
        item['size'] = "";
      }
      if(item['mimeType'] == 'application/vnd.google-apps.folder'){
        html +=`<li class="mdui-list-item mdui-ripple"><a href="${p}">
              <div class="mdui-col-xs-12 mdui-col-sm-7 mdui-text-truncate">
              <i class="mdui-icon material-icons">folder_open</i>
                ${item.name}
              </div>
              <div class="mdui-col-sm-3 mdui-text-right">${item['modifiedTime']}</div>
              <div class="mdui-col-sm-2 mdui-text-right">${item['size']}</div>
              </a>
          </li>`;
      }else{
        let p = path+item.name;
		item['size'] = formatFileSize(item['size']);
        html += `<li class="mdui-list-item file mdui-ripple" target="_blank"><a href="${p}">
            <div class="mdui-col-xs-12 mdui-col-sm-7 mdui-text-truncate">
            <i class="mdui-icon material-icons">insert_drive_file</i>
              ${item.name}
            </div>
            <div class="mdui-col-sm-3 mdui-text-right">${item['modifiedTime']}</div>
            <div class="mdui-col-sm-2 mdui-text-right">${item['size']}</div>
            </a>
        </li>`;
      }

    }

    html += `	</ul></div>`;
    return html;
  }

  list(path, items){
    let siteName = authConfig.siteName;
    let title = `${siteName} - ${path}`;
    let nav = this.nav(path);
    let content = this.ls(path,items.files);
    return this.layout(title, siteName, nav, content);
  }

  layout(title,siteName,nav,content){
    title = decodeURIComponent(title);
    return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0, user-scalable=no"/>
	<title>${title}</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/mdui@0.4.1/dist/css/mdui.min.css" integrity="sha256-lCFxSSYsY5OMx6y8gp8/j6NVngvBh3ulMtrf4SX5Z5A=" crossorigin="anonymous">
	<script src="https://cdn.jsdelivr.net/npm/mdui@0.4.1/dist/js/mdui.min.js" integrity="sha256-dZxrLDxoyEQADIAGrWhPtWqjDFvZZBigzArprSzkKgI=" crossorigin="anonymous"></script>
    <script src="https://cdn.staticfile.org/jquery/3.3.1/jquery.min.js"></script>
    <script src="https://cdn.staticfile.org/layer/2.3/layer.js"></script>
    <script>
    $(function () {
        $('.file a').each(function() {
          $(this).on('click', function() {
              if(this.href.lastIndexOf(".mkv") > 1) {
                layer.open({
                  type: 1,
                  title: decodeURI(this.href.substring(this.href.lastIndexOf("/") + 1, this.href.length)),
                  shadeClose: true,
                  shade: 0.8,
                  area: ['100%', '100%'],
                  content: '<center><video controls autoplay=true preload=auto style="width:80%;object-fit: cover;" src="' + this.href + '"></video></center>'
                });
                return false;
              }
          });
      });
    });
    </script>
	<style>
		.mdui-appbar .mdui-toolbar{
			height:56px;
			font-size: 16px;
		}
		.mdui-toolbar>*{
			padding: 0 6px;
			margin: 0 2px;
			opacity:0.5;
		}
		.mdui-toolbar>.mdui-typo-headline{
			padding: 0 16px 0 0;
		}
		.mdui-toolbar>i{
			padding: 0;
		}
		.mdui-toolbar>a:hover,a.mdui-typo-headline,a.active{
			opacity:1;
		}
		.mdui-container{
			max-width:980px;
		}
		.mdui-list-item{
			-webkit-transition:none;
			transition:none;
		}
		.mdui-list>.th{
			background-color:initial;
		}
		.mdui-list-item>a{
			width:100%;
			line-height: 48px
		}
		.mdui-list-item{
			margin: 2px 0px;
			padding:0;
		}
		.mdui-toolbar>a:last-child{
			opacity:1;
		}
		@media screen and (max-width:980px){
			.mdui-list-item .mdui-text-right{
				display: none;
			}
			.mdui-container{
				width:100% !important;
				margin:0px;
			}
			.mdui-toolbar>*{
				display: none;
			}
			.mdui-toolbar>a:last-child,.mdui-toolbar>.mdui-typo-headline,.mdui-toolbar>i:first-child{
				display: block;
			}
		}
	</style>
</head>
<body class="mdui-theme-primary-blue-grey mdui-theme-accent-blue">
	<header class="mdui-appbar mdui-color-theme">
		<div class="mdui-toolbar mdui-container">
			<a href="/" class="mdui-typo-headline">${siteName}</a>
			${nav}
			<!--<a href="javascript:;" class="mdui-btn mdui-btn-icon"><i class="mdui-icon material-icons">refresh</i></a>-->
		</div>
	</header>
	<div class="mdui-container">
    	${content}
  	</div>
</body>
</html>`;
  }
}

String.prototype.trim = function (char) {
    if (char) {
        return this.replace(new RegExp('^\\'+char+'+|\\'+char+'+$', 'g'), '');
    }
    return this.replace(/^\s+|\s+$/g, '');
};
