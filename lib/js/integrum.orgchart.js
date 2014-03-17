(function ( $ ) {

    $.fn.orgchart = function( options ) {

        var progressBar = $('<div class="ui-progress-bar ui-container" id="progress_bar">' +
            '<div class="ui-progress"><span class="ui-label"><b class="value">%</b></span></div></div>');

        var settings = $.extend({
            // These are the defaults.
            xml: false,
            eWidth: 169,
            eHeight: 60,
            paperMinHeight: 700,
            paperHeight: 'auto',
            paperMinWidth: 600,
            paperWidth: 'auto',
            rankSeparation: 'auto',
            baseUrl: 'http://companies.integrum.ru/CorporateStructure.aspx?orgId=',
            speed: 0.01,
            //градиенты для оформления SVG элементов - здесь нельзя использовать css
            gradients : {
                'rootGrad': {0:'C3F0FC', 50:'A1F1FF', 51:'5EE7FF', 100:'E2FAFF'},
                'l1Grad': {0:'ebffeb', 50:'c7ffc7', 51:'a3ffa3', 100:'eeffee'},
                'l1HoverGrad': {0:'d1ffd1', 50:'74ff74', 51:'1bff1b', 100:'cfffcf'},
                'l2Grad': {0:'f6fbff', 50:'d7f1ff', 51:'d7f1ff', 100:'f4fbff'},
                'l2HoverGrad': {0:'d9f2ff', 50:'99ddff', 51:'48c2ff', 100:'daf2ff'},
                'nolinkGrad': {0:'fbfbfb', 50:'f3f3f3', 51:'f0f0f0', 100:'fbfbfb'},
                'nolinkHoverGrad': {0:'f5f5f5', 50:'e5e5e5', 51:'d3d3d3', 100:'f6f6f6'}
            }
        }, options );

        if ( ! settings.xml) {
            throw new Error('Не передан адрес xml файла');
        }


        var gradString = '';
        _.each(settings.gradients, function(grad, idx){
            gradString += '<linearGradient id="'+idx+'" x1="0%" y1="0%" x2="0%" y2="100%">';
            _.each(grad, function(color, offset){
                gradString +=  '<stop offset="'+offset+'%" stop-color="#'+color+'" stop-opacity="1"/>';
            });
            gradString += '</liearGradient>';
        });

        $(this).before('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>'+gradString+'</defs></svg>');


        var paperWidth = (settings.paperWidth == 'auto') ? ((this.width() < settings.paperMinWidth)  ? settings.paperMinWidth : this.width())  : settings.paperWidth;
        var paperHeight = (settings.paperHeight == 'auto') ? ((this.height() < settings.paperMinHeight)  ? settings.paperMinHeight : this.height()) : settings.paperHeight;
        var eWidth = settings.eWidth;
        var eHeight = settings.eHeight;
        var rankSeparation = (settings.rankSeparation == 'auto') ? (eHeight * 1.3) : settings.rankSeparation;

        var paddingTop = eHeight*0.6;
        var radius = (paperWidth - (eWidth / 3)) / 2;
        var xcenter = paperWidth / 2;

        var dLayout; //global dagre layout obj
        var graph = new joint.dia.Graph;
        var paper = new joint.dia.Paper({
            el: this,
            width: paperWidth,
            height: paperHeight,
            gridSize: 1,
            model: graph
        });

        var edges = {'p1': [], 'd1': []} //ссылки между p2->p1 и d1->d2
        var siblings = {'p1': [], 'd1': [], 'p2': [], 'd2': [], 'root': []} //элементы в групп

        var tooltip = false;
        var allowTooltip = true;
        var followLink = true;

        var S = {
            'p2': {'rank':0,'rank_y':false,'prev_rank_y':false,'next_rank_y':false,'prev_z': 0, 'count': 0, 'image_gap': 0, 'stopAngle': {}, 'currAngle': 0,  'root_edge': {'l_idx': 1000, 'r_idx': 0, 'lx': false, 'rx': false}, 'visibles': {'min': false, 'max': false, 'rx': 0, 'lx': 0}, 'hidden': {'left': 0, 'right': 0}},
            'p1': {'rank':2,'rank_y':false,'prev_rank_y':false,'next_rank_y':false,'prev_z': 0, 'count': 0, 'image_gap': 0, 'stopAngle': {}, 'currAngle': 0, 'root_edge': {'l_idx': 1000, 'r_idx': 0, 'lx': false, 'rx': false}, 'visibles': {'min': false, 'max': false, 'rx': 0, 'lx': 0}, 'hidden': {'left': 0, 'right': 0}},
            'root': {'rank':4,'rank_y':false,'prev_rank_y':false,'next_rank_y':false,'prev_z': 0, 'count': 0, 'image_gap': 0, 'stopAngle': {}, 'currAngle': 0, 'root_edge': {'l_idx': 1000, 'r_idx': 0, 'lx': false, 'rx': false}, 'visibles': {'min': false, 'max': false, 'rx': 0, 'lx': 0}, 'hidden': {'left': 0, 'right': 0}},
            'd1': {'rank':6,'rank_y':false,'prev_rank_y':false,'next_rank_y':false,'prev_z': 0, 'count': 0, 'image_gap': 0, 'stopAngle': {}, 'currAngle': 0, 'root_edge': {'l_idx': 1000, 'r_idx': 0, 'lx': false, 'rx': false}, 'visibles': {'min': false, 'max': false, 'rx': 0, 'lx': 0}, 'hidden': {'left': 0, 'right': 0}},
            'd2': {'rank':8,'rank_y':false,'prev_rank_y':false,'next_rank_y':false,'prev_z': 0, 'count': 0, 'image_gap': 0, 'stopAngle': {}, 'currAngle': 0, 'root_edge': {'l_idx': 1000, 'r_idx': 0, 'lx': false, 'rx': false}, 'visibles': {'min': false, 'max': false, 'rx': 0, 'lx': 0}, 'hidden': {'left': 0, 'right': 0}}
        }

        var angle2rad = function (ang) {
            return ang * Math.PI / 180
        };

        var rad2angle = function (rad) {
            return rad * 180 / Math.PI
        };

        var nodeSetup = function (view) {
            view.$el.attr('class', view.$el.attr('class') + ' ' + view.group);
            if (view.model.get('primaryId') == ''){
                view.$el.attr('class', view.$el.attr('class') + ' nolink');
            }
            view.updatePosition(true);
            view.$el.parent().append(view.$el);
            view.$el.find('.line_in line').attr('class', view.model.get('parentId'));
            view.$el.find('.line_out line').attr('class', view.model.get('id'));
        }

        var edgeSetup = function () {
            //горизонтальные линии между уровнями
            _.each(S, function (sElem, sName) {
                if (sName == 'p1' || sName == 'd1') {

                    //"ненастоящий" коннектор между root и p1/d1
                    var next_rank_y = sElem.next_rank_y;
                    var prev_rank_y = sElem.prev_rank_y;
                    if (sName == 'd1') {
                        next_rank_y = sElem.prev_rank_y;
                        prev_rank_y = sElem.next_rank_y;
                    }
                    var ln = V('<line id="' + sName + '_root_edge' + '" y1="' + next_rank_y + '" y2="' + next_rank_y + '"/>');
                    V(paper.viewport).append(ln);

                    //"настоящие" конекторы между уровнями p1-p2 и d1-d2
                    _.each(siblings[sName], function (elem, i) {
                        var relatives = [];
                        if (sName == 'd1') {
                            relatives = dLayout.successors(elem.model.id)
                        } else if (sName == 'p1') {
                            relatives = dLayout.predecessors(elem.model.id)
                        }
                        if (relatives.length > 0) {
                            var l = V('<line id="link_' + elem.model.id + '" y1="' + prev_rank_y + '" y2="' + prev_rank_y + '"  />');
                            V(paper.viewport).append(l);
                            edges[sName].push({parentId:elem.model.id, 'id': 'link_' + elem.model.id, 'y': prev_rank_y, 'curr_y':prev_rank_y, 'min_x': false, 'max_x': false, 'source': elem.model.id, 'relatives': relatives});
                        }
                    }, this);
                    updateEdges(sName);
                }
            });
        }

        var updateEdges = function(group) {
            var edgeDistance = 3;
            var posDistance = edgeDistance ;
            var negDistance = edgeDistance * (-1);
            var viewGroup = (group == 'p2' ? 'p1' : group == 'd2' ? 'd1' : group);
            var s = S[viewGroup];

            //между root и p1/d1 коннектор всегда простая линия шириной в количество элементов на этом уровне
            var root_lx = (s.root_edge.l_idx >= s.visibles.max) ? s.visibles.lx : s.root_edge.lx;
            var root_rx = (s.root_edge.r_idx <= s.visibles.min) ? s.visibles.rx : s.root_edge.rx;
            if (root_lx !== false && root_rx !== false)
                $('#' + group + '_root_edge').attr({'x1': root_lx, 'x2': root_rx});

            //"настоящие" конекторы между уровнями p1-p2 и d1-d2
            var checkedEdges = [];
            _.each(edges[viewGroup], function (edge) {
                var source = paper.findViewByModel(edge.source);
                edge.min_x = paper.findViewByModel(edge.relatives.slice(-1)[0]).x_center;
                edge.max_x = paper.findViewByModel(edge.relatives[0]).x_center;

                var line_out_name = 'line_out', line_in_name = 'line_in', prev_rank_y_name = 'prev_rank_y', next_rank_y_name = 'next_rank_y';

                if (viewGroup == 'p1') {
                    line_out_name = 'line_in';
                    line_in_name = 'line_out';
                    prev_rank_y_name = 'next_rank_y';
                    next_rank_y_name = 'prev_rank_y';
                }

                if (source.x_center < edge.min_x) {
                    edge.min_x = source.x_center;
                }
                if (source.x_center > edge.max_x) {
                    edge.max_x = source.x_center;
                }
                edge.curr_y = edge.y;

                for (i = 0; i < checkedEdges.length; i++) {
                    if (edge.max_x >= checkedEdges[i].min_x) {
                        if (edge.max_x == source.x_center) {
                            edge.y = checkedEdges[i].y + negDistance;
                        } else {
                            edge.y = checkedEdges[i].y + posDistance;
                        }
                    }
                }
                checkedEdges.push(edge);

                $('#' + edge.id).attr({'x1': edge.min_x, 'y1': edge.y, 'x2': edge.max_x, 'y2': edge.y}).show();
                var distance = edge.y - S[viewGroup][next_rank_y_name];
                if (source[line_out_name]) {
                    var line_out_selector = '.'+line_out_name+' line';
                    source.$el.find(line_out_selector).attr({'y1':source.trueHeight, 'y2':  s[next_rank_y_name] - s.rank_y + distance + source.trueHeight/2});

                    edge.relatives.forEach(function (elem, idx) {
                        var relView = paper.findViewByModel(elem);
                        if (relView[line_in_name]) {
                            var s = S[relView.group];
                            relView.$el.find('.'+line_in_name+' line').attr({'y1':0, 'y2':  s[prev_rank_y_name] - s.rank_y   + distance + relView.trueHeight/2});
                        }
                    });
                }
            });
        }

        var getSettings = function(elem) {
            var s = elem;
            //расстояние между элементами
            var image_gap = Math.floor(rad2angle(eWidth/radius) - 1);
            if (s.count == 1 || s.count == 0) {
                s.image_gap = 0;
            } else if (s.count == 2 || s.count == 3) {
                s.image_gap = (image_gap > 30) ? image_gap : 30;
            } else if (s.count < 7) {
                s.image_gap = (image_gap > 25) ? image_gap : 25;
            } else {
                s.image_gap = image_gap;
            }

            //поправка при четном кол-ве элементов
            var dr = (s.count % 2 == 0) ? 0 : s.image_gap;

            //повернем список на центральный элемент
            s.currAngle = 90 - s.image_gap * Math.floor(s.count / 2);
            //крайние значения углов для остановки прокрутки
            var r = (s.count == 1 || s.count == 0) ? 90 : s.currAngle + s.image_gap * Math.ceil(s.count / 2) - dr;
            var l = (s.count == 1 || s.count == 0) ? 90 : s.currAngle - s.image_gap * Math.ceil(s.count / 2) + s.image_gap;
            s.stopAngle = {'r': r, 'l': l};
            //y-координата для каждой группы элементов считается исходя из высоты элементов
            s.rank_y =  paddingTop + (rankSeparation * s.rank);
            s.prev_rank_y = paddingTop + (rankSeparation * (s.rank - 1));
            s.next_rank_y = paddingTop + (rankSeparation * (s.rank + 1));

            s.root_edge.l_idx = s.count - 1;
            s.visibles.min = s.count-1;
        }

        var makeElement = function(json) {
            var maxLength = 24;

            if (json.name.length > maxLength) {
                var pieces = json.name.split(/[\s]+/);
                json.name = '';
                var curPos = json.name.length;

                for (p in pieces) {
                    if ((curPos + pieces[p].length + 1) <= maxLength) {
                        json.name += ' ' + pieces[p];
                        curPos += pieces[p].length + 1;
                    } else {
                        json.name += '\n' + pieces[p];
                        curPos = pieces[p].length + 1;
                        ;
                    }
                }
            }

            var label = false;

            var line_out = false, line_in = false;
            if (dLayout.inEdges(json.id).length){
                line_in = true;
            }
            if (dLayout.outEdges(json.id).length){
                line_out = true;
            }
            var e =  new joint.shapes.basic.Org({
                id: json.id,
                label: label,
                fullname: json.fullname,
                primaryId: json.primaryId,
                parentId: json.parentId,
                percentShare: json.percentShare,
                amountShare: json.amountShare,
                order: dLayout.node(json.id).order,
                line_out: line_out,
                line_in: line_in,
                size: { width: eWidth, height: eHeight },
                attrs: {
                    '.node text': {text: json.name}
                }
            });
            /*if (label) {
                e.attr({'.label text': {text: label}});
            }*/
            return e;
        }

        var createGraphFromJSON = function(json) {
            var elements = [];

            //создаем лэйаут с помощь Dagre
            dLayout = createDagreFromJSON(json);

            elements.push(makeElement(json.RootCompany));
            if(typeof json.ChildCompanies.ChildCompany != 'undefined'){
                if (Object.prototype.toString.call( json.ChildCompanies.ChildCompany ) !== '[object Array]') {
                    json.ChildCompanies.ChildCompany = [json.ChildCompanies.ChildCompany];
                }
                json.ChildCompanies.ChildCompany.forEach(
                    function (xChild) {
                        elements.push(makeElement(xChild));
                    });
            }

            return elements;
        }

        var createDagreFromJSON = function(json) {

            var dagreGraph = new dagre.Digraph();
            dagreGraph.addNode(json.RootCompany.id, {
                width: eWidth,
                height: eHeight
            });

            if(typeof json.ChildCompanies.ChildCompany != 'undefined'){
                if (Object.prototype.toString.call( json.ChildCompanies.ChildCompany ) !== '[object Array]') {
                    json.ChildCompanies.ChildCompany = [json.ChildCompanies.ChildCompany];
                }
                json.ChildCompanies.ChildCompany.forEach(
                    function (xChild) {

                        var group = 'root';
                        if (xChild.id.substr(0, 1) == 'p' || xChild.id.substr(0, 1) == 'd') {
                            group = xChild.id.substr(0, 2);
                        }
                        S[group].count++;

                        var child = xChild.parentId;
                        var parent = xChild.id;
                        if (xChild.id.substring(0, 1) == 'p') {
                            child = xChild.id;
                            parent = xChild.parentId;
                        }

                        dagreGraph.addNode(xChild.id, {
                            width: eWidth,
                            height: eHeight
                        });
                        dagreGraph.addEdge(parent + '_' + child, child, parent);
                    });
            }
            return dagre.layout().run(dagreGraph);
        }

        var nodeSetupEachCallback  = function (arr, process, callback) {
            var tmpElemGroup = arr;
            var i = 0;
            function work() {
                if (i < arr.length) {
                    i++;
                    process.apply(tmpElemGroup[0]);
                    tmpElemGroup = tmpElemGroup.slice(1);
                    if (tmpElemGroup.length > 0){
                        i++;
                        process.apply(tmpElemGroup.slice(-1)[0]);
                        tmpElemGroup = tmpElemGroup.slice(0, -1);
                    }
                    callback.apply(i, [i]);
                    if (tmpElemGroup.length > 0){
                        setTimeout(work, 0);
                    }
                }
            }
            setTimeout(work, 0);
        };

        joint.shapes.basic.Org = joint.shapes.basic.Generic.extend({
            markup: '<g class="line_out"><line/></g><g class="line_in"><line/><path/></g><g class="node scalable"><rect/><text/></g>',
            defaults: joint.util.deepSupplement({
                type: 'basic.Org',
                attrs: {
                    'path': {d: 'M 0 0'},
                    '.node rect': {'follow-scale': false, rx: 5, ry: 5, width: eWidth, height: eHeight},
                    '.node text': {'ref-x': .5, 'ref-y': .5, ref: 'g.node', 'y-alignment': 'middle', 'x-alignment': 'middle' }
                }
            }, joint.shapes.basic.Generic.prototype.defaults)
        });

        joint.shapes.basic.OrgView = joint.dia.ElementView.extend({
            x: 0,
            y: 0,
            z: 0,
            zindex: 0,
            x_center: 0,
            angle: 0,
            prev_x: -1,
            group: 'root',
            elemIndex: false,
            line_in: false, //id линии входящего линка
            line_out: false, //id линии выходящего линка
            trueWidth: eWidth,
            trueHeight: eHeight,
            is_visible: false,
            tooltip: false,
            rank: 0,

            initialize: function () {
                this.elemIndex = this.model.get('order');
                if (this.model.id.substr(0, 1) == 'p' || this.model.id.substr(0, 1) == 'd') {
                    this.group = this.model.id.substr(0, 2);
                }
                S[this.group].count++;

                if (typeof siblings[this.group] == 'undefined') {
                    siblings[this.group] = []
                }
                siblings[this.group][this.elemIndex] = this;
                this.line_in = this.model.get('line_in');
                this.line_out = this.model.get('line_out');
                joint.dia.ElementView.prototype.initialize.apply(this);
            },


            updatePosition: function (is_setup) {
                is_setup = (typeof is_setup != 'undefined');
                var s = S[this.group];

                // элементы виртуально размещаются по периметру эллипса с радиусом radius и центром в точке xcenter, s.rank_y
                // "перетаскивая" элементы изменям угол поворота эллипса по оси Y

                //"реальный" угол для конктретного элемента
                this.angle = angle2rad(s.currAngle + this.elemIndex * s.image_gap);
                //элементы могут быть "обернуты" вокруг эллипса в несколько слоев
                //поэтому для отрисовки используем нормализованный угол элемента
                angle = (this.angle < 0) ? 0 : this.angle > Math.PI ? Math.PI : this.angle;
                this.x = Math.cos(angle) * radius + xcenter;
                this.y = s.rank_y;
                this.z = Math.sin(angle);
                this.x_center = this.x;
                var distanceFactor = this.z;
                this.trueWidth = distanceFactor * eWidth;
                this.trueHeight = distanceFactor * eHeight;

                var halfWidth = this.trueWidth / 2,
                    halfHeight = this.trueHeight / 2;

                this.x -= halfWidth;
                this.y -= halfHeight;

                if (this.elemIndex <= s.visibles.min) {
                    s.visibles.min = this.elemIndex;
                    s.visibles.rx = this.x_center;
                }
                if (this.elemIndex >= s.visibles.max) {
                    s.visibles.max = this.elemIndex;
                    s.visibles.lx = this.x_center;
                }

                if (s.root_edge.l_idx == this.elemIndex) {
                    s.root_edge.lx = this.x_center;
                } else if (s.root_edge.r_idx == this.elemIndex) {
                    s.root_edge.rx = this.x_center;
                }

                var new_is_visible = (this.angle > 0 && this.angle < Math.PI);
                if (new_is_visible != this.is_visible) {
                    if ( ! new_is_visible) {
                        //прячем элемент
                        this.$el.attr({transform: 'translate('+this.x+','+this.y+') scale(1)'})
                            .find('.scalable').attr({transform: 'translate(0,0) scale(0)'});

                        if (this.line_out) {
                            this.$el.find('.line_out line').attr(
                                {x1:halfWidth , x2:halfWidth, y2: (S[this.group].next_rank_y - S[this.group].rank_y + halfHeight), y1: this.trueHeight}
                            );
                        }

                        if (this.line_in) {
                            this.$el.find('.line_in line').attr(
                                {x1:halfWidth , x2:halfWidth, y2: (S[this.group].prev_rank_y - S[this.group].rank_y + halfHeight), y1: 0}
                            );
                            this.$el.find('.line_in path').attr(
                                {d:'M '+(halfWidth-2)+ ' -7 L '+(halfWidth + 2) + ' -7 L ' + (halfWidth) + ' 0 L '+(halfWidth-2) + ' -7  Z'}
                            );
                        }
                    }
                }

                if (new_is_visible || is_setup) {
                    if (this.line_out) {
                        this.$el.find('.line_out line').attr(
                            {x1:halfWidth , x2:halfWidth, y2: (S[this.group].next_rank_y - S[this.group].rank_y + halfHeight), y1: this.trueHeight}
                        );
                    }

                    if (this.line_in) {
                        this.$el.find('.line_in line').attr(
                            {x1:halfWidth , x2:halfWidth, y2: (S[this.group].prev_rank_y - S[this.group].rank_y + halfHeight), y1: 0}
                        );
                        this.$el.find('.line_in path').attr(
                            {d:'M '+(halfWidth-2)+ ' -7 L '+(halfWidth + 2) + ' -7 L ' + (halfWidth) + ' 0 L '+(halfWidth-2) + ' -7  Z'}
                        );
                    }

                    if (this.model.get('label')){
                        var doubleZ = Math.pow(this.z, 2);
                        if (this.z < 0.5){
                            this.$el.find('.label').attr({display:'none'});
                        } else {
                            this.$el.find('.label').attr({display:'block'});
                            this.$el.find('.label text').attr({opacity: doubleZ});
                        }
                    }
                    //правильный zindex
                    var tmpAngle = rad2angle(this.angle);
                    var negFactor = 0;

                    while (tmpAngle > 270) {
                        negFactor += 2;
                        tmpAngle -= 180;
                    }
                    while (tmpAngle < -110) {
                        negFactor += 2;
                        tmpAngle += 180;
                    }
                    this.zindex = Math.sin(angle2rad(tmpAngle)) - negFactor + 1000;

                    if (this.zindex > s.prev_z) {
                        this.$el.parent().append(this.$el); //вынесем элемент наверх
                    }

                    if (($.browser.mozilla && (new_is_visible != this.is_visible)) || $.browser.safari) {
                        var txt = this.$el.find('.node text');
                        txt.parent().append(txt);
                    }
                    s.prev_z = this.zindex;

                    this.$el.attr({transform: 'translate('+this.x+','+this.y+') scale(1)'})
                        .find('.scalable').attr({transform: 'translate(0,0) scale('+distanceFactor+')'});
                }

                this.is_visible = new_is_visible;
                return this;
            },

            pointerdown: function (evt, x, y) {
                tooltip.hide();
                allowTooltip = false;
                followLink = true;
                this.prev_x = x;
                joint.dia.ElementView.prototype.pointerdown.apply(this, [evt, x, this.model.get('position').y]);
                return this;
            },

            pointermove: function (evt, x, y) {

                followLink = false;
                var dx = this.prev_x - x;
                var s = S[this.group];

                s.currAngle += dx * settings.speed;
                if (s.stopAngle.r < s.currAngle) {
                    s.currAngle = s.stopAngle.r;
                } else if (s.stopAngle.l > s.currAngle) {
                    s.currAngle = s.stopAngle.l;
                }

                s.visibles = {'min': 1000, 'max': 0, 'lx': 0, 'rx': 0}

                /**
                 * итерация по элементам, в зависимости от того, в какую сторону идет прокрутка,
                 * для правильного определения z-index
                 */
                if (dx < 0) {
                    for (var i = 0; i < siblings[this.group].length; i++) {
                        var view = paper.findViewByModel(siblings[this.group][i].model.id).updatePosition();
                    }
                } else {
                    for (var i = siblings[this.group].length - 1; i >= 0; i--) {
                        var view = paper.findViewByModel(siblings[this.group][i].model.id).updatePosition();
                    }
                }

                updateEdges(this.group);
                return this;
            },
            pointerup: function (evt, x, y) {
                if (followLink) {
                    var primaryId = this.model.get('primaryId');
                    if (primaryId) {
                        window.open(settings.baseUrl + primaryId);
                    }
                }
                followLink = true;
                allowTooltip = true;
                S[this.group].prev_x = 0;
                joint.dia.ElementView.prototype.pointerdown.apply(this, [evt, x, y]);
            },

            events: {
                "mouseover": "showTooltip",
                "mouseout": "hideTooltip"
            },

            showTooltip: function () {
                if (allowTooltip) {
                    var label = '<h4>' + this.model.get('fullname') + '</h4>';
                    if (typeof this.model.get('percentShare') != 'undefined' && this.model.get('percentShare') != -1) {
                        label += '<p>доля (%): <b>' + this.model.get('percentShare') + '</b></p>';
                    }
                    if (typeof this.model.get('amountShare') != 'undefined' && this.model.get('amountShare') != -1 && this.model.get('amountShare')) {
                        label += '<p>доля: <b>' + this.model.get('amountShare') + '</b></p>';
                    }

                    tooltip.render({
                        target: '#' + this.$el.attr('id')+' .node',
                        content: label,
                        bottom: '#' + this.$el.attr('id')+' .node'
                    });
                }
            },
            hideTooltip: function () {
                tooltip.hide();
            }

        });



        var progressVal = 7;
        $(this).before(progressBar.css({'top':paperHeight/3}).show());
        $(".ui-progress").animateProgress(progressVal);

        tooltip = new orgTooltip({
            direction: 'bottom'
        });

        $.get(settings.xml, function (xml) {
            progressVal += 7;
            $(".ui-progress").animateProgress(progressVal, function(){

                var jsonObj = $.xml2json(xml);
                var cells = createGraphFromJSON(jsonObj);
                _.each(S, function (elem, i) {
                    getSettings(elem);
                });
                graph.addCells(cells);
                $('#canvas').hide();

                progressVal += 7;
                $(".ui-progress").animateProgress(progressVal);

                var totalSetUpCount = 0;
                _.each(siblings, function (elemGroup, idx) {

                    nodeSetupEachCallback(elemGroup,
                        function () {
                            // “this” is the array item, just like $.each
                            nodeSetup(this);
                        },
                        function (loopcount) {
                            // loopcount is how far into the loop you are
                            if (loopcount % 5 == 0){
                                progressVal += 5;
                                $(".ui-progress").animateProgress(progressVal);
                            }
                            if (loopcount >= elemGroup.length){
                                totalSetUpCount += loopcount;
                            }

                            if (totalSetUpCount >= cells.length) {
                                progressVal == 90;
                                $(".ui-progress").animateProgress(progressVal);
                                edgeSetup();
                                $(".ui-progress").animateProgress(100, function () {
                                    $('#progress_bar').fadeOut(400, function(){
                                        $('#canvas').fadeIn();
                                    });
                                });
                            }
                    });
                });
            });
        })
        .fail(function() {
            $('#progress_bar').fadeOut(400, function(){
                $('#canvas').fadeIn();
            });
            throw new Error('Невозможно открыть файл "'+settings.xml+'"');
        });
    };
}( jQuery ));

orgTooltip = Backbone.View.extend({
    className: "tooltip",
    options: {
        left: void 0,
        right: void 0,
        top: void 0,
        bottom: void 0,
        padding: 10
    },
    initialize: function () {
        //_.bindAll(this, "render", "hide", "position"), this.$target = $(this.options.target), this.$target.on("mouseover", this.render), this.$target.on("mouseout", this.hide), this.$target.on("click", this.hide), this.$el.addClass(this.options.direction)
        this.$el.addClass(this.options.direction)
    },
    remove: function () {
        //this.$target.off("mouseover", this.render), this.$target.off("mouseout", this.remove), Backbone.View.prototype.remove.apply(this, arguments)
        Backbone.View.prototype.remove.apply(this, arguments)
    },
    hide: function () {
        Backbone.View.prototype.remove.apply(this, arguments)
    },
    render: function (options) {
        this.$target = $(options.target);
        this.options.bottom = options.bottom;
        this.options.content = options.content;
        this.$el.html(this.options.content), this.$el.hide(), $(document.body).append(this.$el);
        var t = this.$("img");
        t.length ? t.on("load", this.position) : this.position()
    },
    getElementBBox: function (t) {
        var e, i = $(t),
            n = i.offset(),
            r = document.body.scrollTop || document.documentElement.scrollTop,
            o = document.body.scrollLeft || document.documentElement.scrollLeft;
        return n.top -= r || 0, n.left -= o || 0, t.ownerSVGElement ? (e = V(t).bbox(), e.x = n.left, e.y = n.top) : e = {
            x: n.left,
            y: n.top,
            width: i.outerWidth(),
            height: i.outerHeight()
        }, e
    },
    position: function () {
        this.$target.offset(), this.$target[0];
        var t = this.getElementBBox(this.$target[0]),
            e = this.options.padding;
        this.$el.show();
        var i = this.$el.outerHeight(),
            n = this.$el.outerWidth();
        if (this.options.left) {
            var r = $(this.options.left),
                o = this.getElementBBox(r[0]);
            this.$el.css({
                left: o.x + o.width + e,
                top: t.y + t.height / 2 - i / 2
            })
        } else if (this.options.right) {
            var s = $(this.options.right),
                a = this.getElementBBox(s[0]);
            this.$el.css({
                left: a.x - n - e,
                top: t.y + t.height / 2 - i / 2
            })
        } else if (this.options.top) {
            var A = $(this.options.top),
                l = this.getElementBBox(A[0]);
            this.$el.css({
                top: l.y + l.height + e,
                left: t.x + t.width / 2 - n / 2
            })
        } else if (this.options.bottom) {
            var c = $(this.options.bottom),
                h = this.getElementBBox(c[0]);
            this.$el.css({
                top: h.y - i - e,
                left: t.x + t.width / 2 - n / 2
            })
        } else this.$el.css({
            left: t.x + t.width + e,
            top: t.y + t.height / 2 - i / 2
        })
    }
});

$.urlParam = function (name) {
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if ( ! results) {
        return 0;
    }
    return results[1] || 0;
}

/*Browser detection patch*/

if (!jQuery.browser) {

    jQuery.browser = {};
    jQuery.browser.mozilla = false;
    jQuery.browser.webkit = false;
    jQuery.browser.opera = false;
    jQuery.browser.safari = false;
    jQuery.browser.chrome = false;
    jQuery.browser.msie = false;
    jQuery.browser.android = false;
    jQuery.browser.blackberry = false;
    jQuery.browser.ios = false;
    jQuery.browser.operaMobile = false;
    jQuery.browser.windowsMobile = false;
    jQuery.browser.mobile = false;

    var nAgt = navigator.userAgent;
    jQuery.browser.ua = nAgt;

    jQuery.browser.name = navigator.appName;
    jQuery.browser.fullVersion = '' + parseFloat(navigator.appVersion);
    jQuery.browser.majorVersion = parseInt(navigator.appVersion, 10);
    var nameOffset, verOffset, ix;

// In Opera, the true version is after "Opera" or after "Version"
    if ((verOffset = nAgt.indexOf("Opera")) != -1) {
        jQuery.browser.opera = true;
        jQuery.browser.name = "Opera";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 6);
        if ((verOffset = nAgt.indexOf("Version")) != -1)
            jQuery.browser.fullVersion = nAgt.substring(verOffset + 8);
    }

// In MSIE < 11, the true version is after "MSIE" in userAgent
    else if ((verOffset = nAgt.indexOf("MSIE")) != -1) {
        jQuery.browser.msie = true;
        jQuery.browser.name = "Microsoft Internet Explorer";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 5);
    }

// In TRIDENT (IE11) => 11, the true version is after "rv:" in userAgent
    else if (nAgt.indexOf("Trident") != -1) {
        jQuery.browser.msie = true;
        jQuery.browser.name = "Microsoft Internet Explorer";
        var start = nAgt.indexOf("rv:") + 3;
        var end = start + 4;
        jQuery.browser.fullVersion = nAgt.substring(start, end);
    }

// In Chrome, the true version is after "Chrome"
    else if ((verOffset = nAgt.indexOf("Chrome")) != -1) {
        jQuery.browser.webkit = true;
        jQuery.browser.chrome = true;
        jQuery.browser.name = "Chrome";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 7);
    }
// In Safari, the true version is after "Safari" or after "Version"
    else if ((verOffset = nAgt.indexOf("Safari")) != -1) {
        jQuery.browser.webkit = true;
        jQuery.browser.safari = true;
        jQuery.browser.name = "Safari";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 7);
        if ((verOffset = nAgt.indexOf("Version")) != -1)
            jQuery.browser.fullVersion = nAgt.substring(verOffset + 8);
    }
// In Safari, the true version is after "Safari" or after "Version"
    else if ((verOffset = nAgt.indexOf("AppleWebkit")) != -1) {
        jQuery.browser.webkit = true;
        jQuery.browser.name = "Safari";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 7);
        if ((verOffset = nAgt.indexOf("Version")) != -1)
            jQuery.browser.fullVersion = nAgt.substring(verOffset + 8);
    }
// In Firefox, the true version is after "Firefox"
    else if ((verOffset = nAgt.indexOf("Firefox")) != -1) {
        jQuery.browser.mozilla = true;
        jQuery.browser.name = "Firefox";
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 8);
    }
// In most other browsers, "name/version" is at the end of userAgent
    else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) < (verOffset = nAgt.lastIndexOf('/'))) {
        jQuery.browser.name = nAgt.substring(nameOffset, verOffset);
        jQuery.browser.fullVersion = nAgt.substring(verOffset + 1);
        if (jQuery.browser.name.toLowerCase() == jQuery.browser.name.toUpperCase()) {
            jQuery.browser.name = navigator.appName;
        }
    }

    /*Check all mobile environments*/
    jQuery.browser.android = (/Android/i).test(nAgt);
    jQuery.browser.blackberry = (/BlackBerry/i).test(nAgt);
    jQuery.browser.ios = (/iPhone|iPad|iPod/i).test(nAgt);
    jQuery.browser.operaMobile = (/Opera Mini/i).test(nAgt);
    jQuery.browser.windowsMobile = (/IEMobile/i).test(nAgt);
    jQuery.browser.mobile = jQuery.browser.android || jQuery.browser.blackberry || jQuery.browser.ios || jQuery.browser.windowsMobile || jQuery.browser.operaMobile;


// trim the fullVersion string at semicolon/space if present
    if ((ix = jQuery.browser.fullVersion.indexOf(";")) != -1)
        jQuery.browser.fullVersion = jQuery.browser.fullVersion.substring(0, ix);
    if ((ix = jQuery.browser.fullVersion.indexOf(" ")) != -1)
        jQuery.browser.fullVersion = jQuery.browser.fullVersion.substring(0, ix);

    jQuery.browser.majorVersion = parseInt('' + jQuery.browser.fullVersion, 10);
    if (isNaN(jQuery.browser.majorVersion)) {
        jQuery.browser.fullVersion = '' + parseFloat(navigator.appVersion);
        jQuery.browser.majorVersion = parseInt(navigator.appVersion, 10);
    }
    jQuery.browser.version = jQuery.browser.majorVersion;
}