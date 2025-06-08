# Wolai API
通过wolai开放API，可以访问wolai 的块、页面、数据库等（未来开放），在wolai开发者中心创建一个应用，将应用连接到wolai，实现更多自有场景的数据连接。wolai开放API采用RESTful规范，通过 GET，POST...请求来获取数据。发送所有请求的 base URL 是 `https://openapi.wolai.com/v1`。（目前仅提供 API，暂不支持SDK）
您可以用wolai API 打通三方应用（同步滴答清单，微信，钉钉，飞书到wolai），或者自建应用。（支持PDF导入，生成自动汇总的周报，基于数据表格的图表生成等）
# 创建 Token POST /token
### 接口描述

创建用于访问后续API的Token

### 请求地址

**POST **`/token`

### 请求参数  *[Request Body]*

||||
|-|-|-|
|App**Id** *string*|应用ID|`必填`|
|**AppSecret** *string*|应用秘钥|`必填`|




### 返回参数说明

返回 Token 信息



### 请求示例 

```JSON
{
    "appId":"qGPon7raLEu4nJTXCBkeDB",
    "appSecret":"e8501b4c8ed17f97961db65d438c61ba0c4d58ad894ac23c924c1a098b03b1f7"
}

```

### 返回示例 

```JSON
//成功
{
    "data": {
        "app_token": "63b826cad9b3154670ff4242641c1f175320bf6b1b501bc860c7bb4772c9ce74",
        "app_id": "qGPon7raLEu4nJTXCBkeDA",
        "create_time": 1671523112626,
        "expire_time": -1,
        "update_time": 1671523112626
    }
}
//失败
{
    "data": null
}
```


# 创建块 POST /blocks
### 接口描述

创建一个块或多个块并插入到 parent_id 对应的块下

创建限制：单次批量不能超过20个块

### 请求地址

**POST** ** **`/block`

### *请求参数 [Request Body] *

#### 基础参数

在 Body json 内填入 blocks 及parent_id属性 。blocsk 可以为单个block 或 block 数组，block 对象 内 type 为必传字段，类型为支持的块类型（详见BlockTypes)，其余字段查看下方。 **↳ **符号表示为 blocks 包含的子字段， 详见右侧请求示例。

|属性名|类型|必填/可选|描述|
|-|-|-|-|
|parent_id|string|`必填`|父块 ID|
|blocks|单个Block对象或Block数组 注意下方为块可选的公共属性|`必填`|包含以下公共属性，及特殊属性的顶层字段|
|**↳ **type|BlockTypes|`必填`|块类型|
|**↳ **block_front_color|BlockFrontColors||前景色|
|**↳ **block_back_color|BlockBackColors||背景色|
|**↳ **text_alignment|TextAlign||文本对齐|
|**↳ **block_alignment|BlockAlign||块对齐|
|**↳ **其他属性|参考Block|||


什么是父块 ？
wolai 中父子关系有三种，一种是页面里的内容，一种是所有缩进的内容都是子块，另外一种是容器块，如分栏和模板按钮内的内容是该容器块的子块。

  如:

  1. 当前页面包含了文本，简单表格，着重块，代码块等一系列块。注意包含的块并不包括页面本身。
  2. 缩进子块

      父块

        子块
  3. 容器块

      包含一个待办列表子块
        - [ ] 



parent_id 为父块id, 可以从块菜单内的“复制块 ID” 来获取。页面块可以从
该页面的访问链接内最后的路径来获取[//]: # (如这个页面的链接为 [https://www.wolai.com/wolai/iSCCMiztmGHpoNhe4JrSsk](https://www.wolai.com/wolai/iSCCMiztmGHpoNhe4JrSsk)，则该页面ID 为iSCCMiztmGHpoNhe4JrSsk)，也可以从父页面或父块内该块的块菜单内的“复制页面ID”来获取。

  ![](https://secure2.wostatic.cn/static/ktT6UgZzBe5ZCmfZwh2jtC/image.png?auth_key=1748942946-exth5iYLWT8w5uaCz5cBPQ-0-c723d3d045c7dbdb2c2cfca99be8d8bf)

  ![](https://secure2.wostatic.cn/static/iTxsrNA6ETPGcffhUdNFUT/image.png?auth_key=1748942946-f3ze7FTwXq9s4KRJEEBHeT-0-b26d5eb066a617c369607bcf01d463b4)



### 返回参数

可访问的块链接

### 请求示例* *

```JSON
{
  "parent_id": "父块ID",
  "blocks": [
      {
          "type": "text",
          "content": "Hello ",
          "text_alignment": "center"
      },
      {
          "type": "heading",
          "level": 1,
          "content": {
            "title": "World!",
            "front_color": "red"
          },
           "text_alignment": "center"
      }
  ]
}

```



### 返回示例 

```JSON
//成功
{ 
  "data":"https://www.wolai.com/o4icCBRxnvHS99j1RRAuAp#iTZum4zcxGNRpdeVcVvzWw"
}

//失败
{
    "message": "Token 未填写, 请检查 Header 中 Authorization 字段内是否填写 Token, Token 相关说明请参考：https://www.wolai.com/eLKwqTsGHaXV6SvjedEt43：",
    "error_code": 17003,
    "status_code": 401
}
```

# 插入数据  POST /databases/{id}/rows
### 接口描述

插入数据表格行数据

如果插入多选/单选列中包含目前数据表格该列中不存在的选项，会对该多选/单选列自动增加选项。

### 请求地址

POST ** **`/databases/{id}/rows`

### 获取数据表格 ID

**数据表格嵌入块**

- 从数据表格菜单中获取，选择  下的复制访问链接，并取出链接最后的 ID。

    ![](https://secure2.wostatic.cn/static/fGYrKkYMQ6miSPxXYgvqmC/image.png?auth_key=1748942760-r6L4Qq7FZ2PVadbCPZBuay-0-80b1abe7088c16b0f2b2680fc766ed5f)
- 选择块菜单旁边的 **复制引用视图链接**，/后 ？前面的中间部分为数据表格块 ID，示例：

    [https://www.wolai.com/5FSqWmTrdAXBXo3EQhDCq4?viewId=s9k2EPzfqUaVSRXPnKGb](https://www.wolai.com/5FSqWmTrdAXBXo3EQhDCq4?viewId=s9k2EPzfqUaVSRXPnKGb)

    其中 `5FSqWmTrdAXBXo3EQhDCq4`  为数据表格块 ID。

**数据表格页面**

- 从页面域名中获取，示例：[https://www.wolai.com/wolaiteam/4prhMAfrPzoipvkXhPKD34](https://www.wolai.com/wolaiteam/4prhMAfrPzoipvkXhPKD34)  其中`4prhMAfrPzoipvkXhPKD34`为数据表格块 ID。
- 从数据表格菜单中获取，方法同上。

### *请求参数  [Request Path]*

||||
|-|-|-|
|**Id** *string*|数据表格块 ID 可以在页面域名内或者数据表格全局菜单获取|`必填`|


### *请求参数  [Request Body]*

||||
|-|-|-|
|**rows** CreateDatabaseRow[]|要插入的多行数据数组，最多支持单次插入 20行。|`必填`|




### *返回参数 *

|||
|-|-|
|**data** *string*[]|数据行页面链接列表|


### *请求示例 *

```JSON
POST https://openapi.wolai.com/v1/databases/c1YSDeeFUKXddmFtV1wTu9/rows

{
  "rows": [{
    "标题": "标题",
    "多选列": ["1", "2"],
    "数字": 12,
    "CheckBox": false
  }]
}
```

### *返回示例 *

```JSON
//成功
{
    "data": ["https://www.wolai.com/c1YSDeeFUKXddmFtV1wTu9"]
}
}
//失败
{
    "message": "缺少请求体 Body",
    "error_code": 17001,
    "status_code": 400
}
```

# 获取表格内容 GET /databases/{id}


### 接口描述

获取数据表格内容

### 请求地址

**GET** ** **`/databases/{id}`

### 获取数据表格 ID

**数据表格嵌入块**

- 从数据表格菜单中获取，选择  下的复制访问链接，并取出链接最后的 ID。

    ![](https://secure2.wostatic.cn/static/fGYrKkYMQ6miSPxXYgvqmC/image.png?auth_key=1748959068-wAhNL72dNEU7j96Rmugo2w-0-11082dd25b5924babcfd38a212645c36)
- 选择块菜单旁边的 **复制引用视图链接**，/后 ？前面的中间部分为数据表格块 ID，示例：

    [https://www.wolai.com/5FSqWmTrdAXBXo3EQhDCq4?viewId=s9k2EPzfqUaVSRXPnKGb](https://www.wolai.com/5FSqWmTrdAXBXo3EQhDCq4?viewId=s9k2EPzfqUaVSRXPnKGb)

    其中 `5FSqWmTrdAXBXo3EQhDCq4`  为数据表格块 ID。

**数据表格页面**

- 从页面域名中获取，示例：[https://www.wolai.com/wolaiteam/4prhMAfrPzoipvkXhPKD34](https://www.wolai.com/wolaiteam/4prhMAfrPzoipvkXhPKD34)  其中`4prhMAfrPzoipvkXhPKD34`为数据表格块 ID。
- 从数据表格菜单中获取，方法同上。

### *请求参数  [Request Path]*

||||
|-|-|-|
|**blockId** *string*|数据表格块 ID 可以在页面域名内或者数据表格全局菜单获取|`必填`|


### *返回参数 *

|||
|-|-|
|**ColumnOrder** *string[]*|列顺序，以列名排序|
|**Rows** DatabaseRowData*[]*|数据表格内容，数据表格行列表，每行包含每列对应的数据|




### *请求示例 *

```JSON
GET https://openapi.wolai.com/v1/databases/c1YSDeeFUKXddmFtV1wTu9
```

### *返回示例 *

```JSON
//成功
{
    "data": {
        "column_order": [
            "标题",
            "标签"
        ],
        "rows": [
            {
                "page_id": "4YRtvKiYMQBXGvjz7Y52hC", //行对应的页面 ID
                "data": {
                    "标题": {
                        "type": "primary",
                        "value": "测试"
                    },
                    "标签": {
                        "type": "select",
                        "value": "待完成"
                    }
                }
            }
        ]
    }
}
//失败
{
    "message": "Token 未填写, 请检查 Header 中 Authorization 字段内是否填写 Token, Token 相关说明请参考：https://www.wolai.com/wolai/a3qaYWF3P3SWUGxWPvxTjP",
    "error_code": 17003,
    "status_code": 401
}
```

# 分页参数
### 请求

资源分页都接受以下请求参数(query paramters)

如: `/block/{id}/children?page_size=10&start_cursor=cursor_id`

|**参数**|**类型**|**描述**|
|-|-|-|
|`start_cursor`|`string`（可选的）|从上一个响应中返回的`cursor`，用于请求下一页的结果。 默认值： `undefined`，表示从列表的开始返回结果。|
|`page_size`|`number`（可选的）|响应中需要的完整列表中的项目数量。  默认值：`200 `最多：`200  `响应可能包含少于这个数量的结果。|


### 响应

资源的批量请求会返回以下参数：

|**字段**|**类型**|**描述**|
|-|-|-|
|`has_more`|`boolean`|当响应包括列表的结尾时，为`false`。否则，为`true`。|
|`next_cursor`|`string`|只有当`has_more`为 `true`时才可用。  用来检索下一页的结果，方法是将该值作为`start_cursor`参数传递给同一个端点。|

# 块类型

[Block](https://www.wolai.com/sBh7HkJUCtEMVcDF8xo9Gz)

[BlockTypes](https://www.wolai.com/2RsvgCzmLo5fvQrDxfSXyW)

[BlockBackColors](https://www.wolai.com/bCwb12wh1ke4hYb2GiNHcS)

[BlockFrontColors](https://www.wolai.com/4wCxFNa2kScj9tRUMRhPzG)

[InlineTitleType](https://www.wolai.com/2hVfKgFPjZVN8vd7FQpACX)

[ RichText](https://www.wolai.com/mYn9ePcFv7UzHezoLr3CXE)

[BlockAlign](https://www.wolai.com/quouz2gwGy7dqnwHWkfZJu)

[TextAlign](https://www.wolai.com/bwvNHsJmknpnsgdNHKyTAE)

[CreateRichText](https://www.wolai.com/sCbv85cCmDNvH6mkvANvwj)

[HeadingLevel](https://www.wolai.com/1hsY7VqXPHov43Qz4booyT)

[EmojiIcon](https://www.wolai.com/wjXib8ykTN19MNd6LmpTKW)

[LinkIcon](https://www.wolai.com/faU5M5NK2KYdfNurfu6yfX)

[CodeSetting](https://www.wolai.com/cKn5FuFjnmHxCxzcHmpn7a)

[CodeLanguage](https://www.wolai.com/3Uimn9YiAtFQMgFQGxn5BU)

[LinkCover](https://www.wolai.com/3Bbc25FEey8JULGkdc4BSR)

[TodoListProStatus](https://www.wolai.com/qJRTMukqYLKdLzjEY2dz11)

[PageSetting](https://www.wolai.com/79S6Lw12HDXq2GE1EmuUKE)

[鼠标悬停](https://www.wolai.com/mvpw6R5PxsjqyvFYgqGetQ)

[分页参数](https://www.wolai.com/83f7rDQPRFCcLwwnjhPMkP)

