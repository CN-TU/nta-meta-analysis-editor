{
  const NUMBER = "<free-number>";
  const BOOLEAN = "<free-boolean>";
  const FEATURE = "<base-feature>";
  const ANYTHING = "<anything>"; // for unknown or error recovery
  function down(context) {
      switch(context) {
        case "flows":
          return "packets";
        case "flow_aggregations":
          return "flows";
        default:
          return false;
      }
    }
  function down2(context) {
      if(context == "flow_aggregations")
        return "packets";
      return false;
  }
  function defChecker() {
    this.BASE = "<value>"; // where should we start?
    this.functions = new Map();
    this.verbs = new Map();
    this.spec_features = new Map();
    this.addFunction = function(name, args, ret) {
      args = args[0];
      let id = args.length;
      if (typeof args[0] == "object" && args[0].type == "oneormore") {
        id = 0;
        args = args[0].term;
      }
      if (this.functions.has(name)) {
        if (this.functions.get(name)[id] !== undefined) {
          this.functions.get(name)[id].push([args,ret]);
        } else {
          this.functions.get(name)[id] = [[args, ret]];
        }
      } else {
        let arr = []
        arr[id] = [[args, ret]];
        this.functions.set(name, arr);
      }
    }
    this.addVerb = function(name, ret) {
      if (name.startsWith('<')) {
        if (this.verbs.has(name)) {
          this.verbs.get(name).push(ret);
        } else {
          this.verbs.set(name, [ret]);
        }
      } else {
        this.spec_features.set(name, ret);
      }
    }
    this.arguments = function(item, want, err, context) {
      switch(item.type) {
        case "feature":
        case "number":
        case "boolean":
          return null;
        case "operation":
          let n = item.args.length;
          if (item.name.startsWith('__')) {
            return [[Array(n).fill(ANYTHING), ANYTHING, context]];
          }
          let variants = this.functions.get(item.name);
          if (variants === undefined) {
            item.error = "Function not found";
            err.push(item);
            return [[Array(n).fill(ANYTHING), ANYTHING, context]];
          }
          let ret = [];
          if (variants[n] !== undefined) {
            for(let i=0; i<variants[n].length; i++) {
              if (want == undefined) {
                ret.push(variants[n][i].concat(context));
              } else {
                 let [ok, newcontext] = this.compareVerbs(variants[n][i][1], want, context);
                 if(ok) {
                   ret.push(variants[n][i].concat(newcontext));
                 }
              }
            }
          }
          if (variants[0] !== undefined) {
            for(let i=0; i<variants[0].length; i++) {
              if (want == undefined) {
                ret.push([Array(n).fill(variants[0][i][0]), variants[0][i][1], context])
              } else {
                 let [ok, newcontext] = this.compareVerbs(variants[0][i][1], want, context);
                 if(ok) {
                   ret.push([Array(n).fill(variants[0][i][0]), variants[0][i][1], newcontext]);
                 }
              }
            }
          }
          return ret;
      }
    }
    this.compareVerbs = function(a, want, context) {
      if (want == ANYTHING) return [true, context];
      if (a == want) return [true, context];
      if (this.verbs.has(a)) {
        for(let newa of this.verbs.get(a)) {
          let [ok, newcontext] = this.compareVerbs(newa, want, context)
          if (ok)
            return [true, newcontext];
        }
      }
      if(a == "<value>") {
        let tmp = down2(context);
        if(tmp !== false) {
          let [ok, newcontext] = this.compareVerbs("<down2>", want, tmp)
          if (ok)
            return [true, newcontext];
        }
        tmp = down(context);
        console.log("down possible?", context, tmp);
        if(tmp !== false) {
          let [ok, newcontext] = this.compareVerbs("<down>", want, tmp)
          if (ok) {
            console.log("down used!");
            return [true, newcontext];
          }
        }
      }
      return [false, context];
    }
    this.isValid = function(item, want, context) {
      return this.compareVerbs(this.type(item), want, context);
    }
    this.type = function(item) {
      switch(item.type) {
        case "number":
          return NUMBER;
        case "boolean":
          return BOOLEAN;
        case "feature":
          if(this.spec_features.has(item.name)) {
            return this.spec_features.get(item.name);
          }
          return FEATURE;
      }
      throw "Unknown item";
    }
  }

  var defs = new defChecker();

  function appendTerm(type, terms) {
    if (type == "<aggregation-feature>" || type == "<packet-feature>" || type == "<flow-feature>")
      return;
    for(let i=0; i<terms.length; i++) {
      switch(typeof terms[i]) {
          case "string":
/*                  if (terms[i] == "<feature>" || type == "<feature>") {
                  continue;
              }*/
              defs.addVerb(terms[i], type);
              continue;
          case "boolean":
              defs.addVerb(BOOLEAN, type);
              continue;
          case "object":
              let key=Object.keys(terms[i])[0];
              defs.addFunction(key, terms[i][key], type)
              continue;
      }
    }
  }
}

Specifications
  = specs:(spec:Specification? [ \t]* '\n' {return spec;})* { return defs; }

Specification
  = [ \t]* Comment {} /
    [ \t]* type:Type _ "->" _ terms:Terms [ \t]* Comment? { appendTerm(type, terms); }

Terms
  = head:Value tail:(_ '|' _ t:Value { return t;})* { return [head].concat(tail); }

Value
  = Null /
    t:Type _ '+' { return {type: 'oneormore', term:t}; }  /
  	Type /
    Object /
    Array /
    String /
    Bool

Object
  ='{' _ prop:Properties _ '}' { return prop; }

Properties
  = head:Property tail:(_ ',' _ p:Property { return p; })* { return Object.assign({}, head, ...tail); }
  
Property
  = key:String _ ':' _ value:Terms { let ret = {}; ret[key] = value; return ret }

Array
  = '[' head:Value tail:(_ ',' _ t:Value {return t;})* ']' {return [head].concat(tail);} 

Type
  = '<' ([^>]+) '>' { return text(); }
  
String
  = '"' s:([^"]+ {return text();}) '"' { return s; }
  
Null
  = 'null'i { return null; }

Bool
  = ('true'i/'false'i) { return text().toLowerCase() == "true"; }

Comment "Comment"
  = '#' [^\n]*

_ "whitespace"
  = [ \t]* (Comment? '\n')* [ \t]*
              